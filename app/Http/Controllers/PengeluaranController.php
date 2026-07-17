<?php

namespace App\Http\Controllers;

use App\Http\Requests\ExpenseRequest;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Services\ActivityLogService;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class PengeluaranController extends Controller
{
    /**
     * Batas retry saat nomor pengeluaran bentrok (unique index) —
     * DATABASE.md Bab 10, pola sama dengan nomor transaksi/pembelian.
     */
    private const MAX_NUMBER_RETRY = 5;

    /**
     * Halaman Pengeluaran (Fase 9 — PRD 5.10): paginated, search
     * nomor/judul, filter kategori/metode/rentang tanggal, kartu
     * statistik. Kasir view only. Owner dapat melihat daftar terhapus
     * (trash) lewat parameter `trashed=1` — pola sama dengan Supplier.
     * Pengeluaran TIDAK menyentuh stok (bedakan dengan Pembelian).
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $categoryId = $request->query('category');
        $method = $request->query('payment_method');
        $dateFrom = $this->parseDate($request->query('date_from'));
        $dateTo = $this->parseDate($request->query('date_to'));
        // Trash hanya untuk Owner; role lain param diabaikan
        $showTrash = $request->boolean('trashed')
            && $request->user()->can('viewTrash', Expense::class);

        $expenses = Expense::query()
            ->with([
                // withTrashed: pengeluaran berkategori terhapus tetap tampil
                'category' => fn ($query) => $query->withTrashed()->select('id', 'name'),
                'user' => fn ($query) => $query->withTrashed()->select('id', 'name'),
            ])
            ->when($showTrash, fn ($query) => $query->onlyTrashed())
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('expense_number', 'like', "%{$search}%")
                        ->orWhere('title', 'like', "%{$search}%");
                });
            })
            ->when($categoryId, fn ($query, $categoryId) => $query->where('expense_category_id', $categoryId))
            ->when(
                in_array($method, ['tunai', 'qris', 'transfer', 'kartu'], true),
                fn ($query) => $query->where('payment_method', $method),
            )
            ->when($dateFrom !== null, fn ($query) => $query->where('expense_date', '>=', $dateFrom->toDateString()))
            ->when($dateTo !== null, fn ($query) => $query->where('expense_date', '<=', $dateTo->toDateString()))
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Expense $expense) => [
                'id' => $expense->id,
                'expense_number' => $expense->expense_number,
                'expense_date' => $expense->expense_date->toDateString(),
                'expense_category_id' => $expense->expense_category_id,
                'category' => $expense->category->name,
                'title' => $expense->title,
                'amount' => $expense->amount,
                'payment_method' => $expense->payment_method,
                'notes' => $expense->notes,
                'receipt_url' => $expense->receiptUrl(),
                'receipt_is_pdf' => $expense->receiptIsPdf(),
                'user' => $expense->user->name,
                'created_at' => $expense->created_at->toIso8601String(),
                'deleted_at' => $expense->deleted_at?->toIso8601String(),
            ]);

        return Inertia::render('Pengeluaran/Index', [
            'expenses' => $expenses,
            'filters' => [
                'search' => $search,
                'category' => $categoryId !== null ? (int) $categoryId : null,
                'payment_method' => $method,
                'date_from' => $dateFrom?->toDateString() ?? '',
                'date_to' => $dateTo?->toDateString() ?? '',
                'trashed' => $showTrash,
            ],
            // expenses_count termasuk yang terhapus — kategori terpakai
            // (walau pengeluarannya di-soft-delete) tak boleh dihapus
            'categories' => ExpenseCategory::query()
                ->withCount(['expenses' => fn ($query) => $query->withTrashed()])
                ->orderBy('name')
                ->get(['id', 'name', 'is_active']),
            // Form hanya menampilkan metode aktif; daftar lengkap
            // tetap dikirim untuk label kolom & filter (PRD 5.10)
            'payment_methods' => PaymentMethod::query()
                ->orderBy('id')
                ->get(['id', 'name', 'code', 'is_active']),
            'stats' => [
                'total' => Expense::count(),
                'hari_ini' => Expense::whereDate('expense_date', now()->toDateString())->count(),
                'bulan_ini' => Expense::whereBetween('expense_date', [
                    now()->startOfMonth()->toDateString(),
                    now()->endOfMonth()->toDateString(),
                ])->count(),
                'total_nominal' => (int) Expense::sum('amount'),
            ],
            'can' => [
                'manage' => $request->user()->can('create', Expense::class),
                'delete' => $request->user()->role === User::ROLE_OWNER,
                'viewTrash' => $request->user()->can('viewTrash', Expense::class),
            ],
        ]);
    }

    /**
     * Simpan pengeluaran — nomor `EXP-YYYYMMDD-0001` otomatis di dalam
     * DB::transaction(); bentrok unique index → retry. User pencatat
     * otomatis dari user login, tidak pernah diterima dari request
     * (PRD 5.10).
     */
    public function store(ExpenseRequest $request): RedirectResponse
    {
        Gate::authorize('create', Expense::class);

        $data = $request->validated();
        $receiptPath = $request->hasFile('receipt')
            ? $request->file('receipt')->store('expenses', 'public')
            : null;

        $attempt = 0;

        do {
            try {
                $expense = DB::transaction(fn () => Expense::create([
                    'user_id' => $request->user()->id,
                    'expense_category_id' => $data['expense_category_id'],
                    'expense_number' => Expense::nextExpenseNumber(),
                    'expense_date' => $data['expense_date'],
                    'title' => $data['title'],
                    'amount' => $data['amount'],
                    'payment_method' => $data['payment_method'],
                    'notes' => ($data['notes'] ?? '') !== '' ? $data['notes'] : null,
                    'receipt_path' => $receiptPath,
                ]));

                break;
            } catch (UniqueConstraintViolationException $e) {
                if (++$attempt >= self::MAX_NUMBER_RETRY) {
                    throw $e;
                }
            }
        } while (true);

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_PENGELUARAN,
            'Tambah Pengeluaran',
            "Mencatat pengeluaran {$expense->expense_number} ({$expense->title})",
        );

        return back()->with(
            'success',
            "Pengeluaran {$expense->expense_number} berhasil disimpan.",
        );
    }

    /**
     * Edit pengeluaran — nomor & user pencatat tidak pernah berubah.
     * Bukti baru menggantikan file lama (file lama dihapus).
     */
    public function update(ExpenseRequest $request, Expense $expense): RedirectResponse
    {
        Gate::authorize('update', $expense);

        $data = $request->validated();

        $payload = [
            'expense_category_id' => $data['expense_category_id'],
            'expense_date' => $data['expense_date'],
            'title' => $data['title'],
            'amount' => $data['amount'],
            'payment_method' => $data['payment_method'],
            'notes' => ($data['notes'] ?? '') !== '' ? $data['notes'] : null,
        ];

        if ($request->hasFile('receipt')) {
            $payload['receipt_path'] = $request->file('receipt')->store('expenses', 'public');

            if ($expense->receipt_path !== null && $expense->receipt_path !== $payload['receipt_path']) {
                Storage::disk('public')->delete($expense->receipt_path);
            }
        }

        $expense->update($payload);

        return back()->with('success', 'Pengeluaran berhasil diperbarui.');
    }

    /**
     * Hapus pengeluaran — selalu soft delete; bukti tidak dihapus agar
     * restore mengembalikan data utuh. Hanya Owner (ExpensePolicy).
     */
    public function destroy(Request $request, Expense $expense): RedirectResponse
    {
        Gate::authorize('delete', $expense);

        $expense->delete();

        return back()->with('success', "Pengeluaran {$expense->expense_number} berhasil dihapus.");
    }

    /**
     * Restore pengeluaran terhapus — hanya Owner (Fase 9).
     */
    public function restore(Request $request, Expense $expense): RedirectResponse
    {
        Gate::authorize('restore', $expense);

        $expense->restore();

        return back()->with('success', "Pengeluaran {$expense->expense_number} berhasil dipulihkan.");
    }

    private function parseDate(?string $value): ?CarbonImmutable
    {
        return rescue(
            fn () => $value !== null && $value !== ''
                ? CarbonImmutable::parse($value)
                : null,
            null,
            report: false,
        );
    }
}
