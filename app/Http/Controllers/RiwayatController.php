<?php

namespace App\Http\Controllers;

use App\Http\Requests\CancelTransactionRequest;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Setting;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ActivityLogService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RiwayatController extends Controller
{
    /**
     * Halaman Riwayat Transaksi (PRD 5.11) — paginated, default hari
     * ini, filter tanggal/metode/status/kasir + search invoice.
     * Kasir hanya melihat transaksi miliknya sendiri.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isKasir = $user->role === User::ROLE_KASIR;

        // Default hari ini; param dikirim kosong = tanpa batas tanggal
        $dateFrom = $this->dateFilter($request, 'date_from');
        $dateTo = $this->dateFilter($request, 'date_to');
        $search = trim((string) $request->query('search', ''));
        $method = $request->query('payment_method');
        $status = $request->query('status');
        $kasirId = $request->query('kasir');

        $transactions = Transaction::query()
            ->with('user:id,name')
            ->withCount('items')
            // Kasir dikunci ke transaksinya sendiri; filter kasir hanya
            // berlaku untuk Admin/Owner (PRD 5.11)
            ->when($isKasir, fn ($query) => $query->where('user_id', $user->id))
            ->when(! $isKasir && $kasirId, fn ($query) => $query->where('user_id', $kasirId))
            // Rentang waktu memakai perbandingan langsung pada created_at
            // (bukan whereDate) agar index created_at tetap terpakai
            ->when($dateFrom !== null, fn ($query) => $query->where('created_at', '>=', $dateFrom->startOfDay()))
            ->when($dateTo !== null, fn ($query) => $query->where('created_at', '<=', $dateTo->endOfDay()))
            ->when(in_array($method, ['tunai', 'qris', 'transfer', 'kartu'], true), fn ($query) => $query->where('payment_method', $method))
            ->when(in_array($status, [Transaction::STATUS_PAID, Transaction::STATUS_CANCELLED], true), fn ($query) => $query->where('status', $status))
            ->when($search !== '', fn ($query) => $query->where('invoice_number', 'like', "%{$search}%"))
            ->latest()
            ->latest('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Transaction $transaction) => [
                'id' => $transaction->id,
                'invoice_number' => $transaction->invoice_number,
                'date' => $transaction->created_at->toIso8601String(),
                'kasir' => $transaction->user->name,
                'payment_method' => $transaction->payment_method,
                'status' => $transaction->status,
                'total' => $transaction->total,
                'items_count' => $transaction->items_count,
            ]);

        return Inertia::render('Riwayat/Index', [
            'transactions' => $transactions,
            'filters' => [
                'date_from' => $dateFrom?->toDateString() ?? '',
                'date_to' => $dateTo?->toDateString() ?? '',
                'search' => $search,
                'payment_method' => $method,
                'status' => $status,
                'kasir' => $kasirId !== null ? (int) $kasirId : null,
            ],
            // Dropdown filter kasir — hanya untuk Admin/Owner
            'kasirs' => $isKasir
                ? []
                : User::withTrashed()->orderBy('name')->get(['id', 'name']),
            // Semua metode (termasuk nonaktif) — transaksi lama bisa
            // memakai metode yang kini dinonaktifkan
            'paymentMethods' => PaymentMethod::query()
                ->orderBy('id')
                ->get(['id', 'name', 'code']),
            // Profil Toko untuk cetak ulang struk (template Fase 5)
            'receiptProfile' => $this->receiptProfile(),
        ]);
    }

    /**
     * Detail transaksi (PRD 5.11) — seluruh data berasal dari snapshot
     * transactions + transaction_items, bukan tabel products.
     */
    public function show(Transaction $transaction): JsonResponse
    {
        Gate::authorize('view', $transaction);

        return response()->json([
            'transaction' => $this->detailPayload($transaction),
        ]);
    }

    /**
     * Pembatalan transaksi (PRD 5.4) — Owner only, wajib alasan.
     * Atomic: ubah status + kembalikan stok + stock_movement adjustment
     * dalam satu DB::transaction(); gagal apa pun → rollback semua.
     */
    public function cancel(CancelTransactionRequest $request, Transaction $transaction): RedirectResponse
    {
        DB::transaction(function () use ($request, $transaction) {
            // Kunci baris transaksi — cegah pembatalan ganda bersamaan
            $locked = Transaction::query()
                ->whereKey($transaction->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($locked->status === Transaction::STATUS_CANCELLED) {
                throw ValidationException::withMessages([
                    'cancel_reason' => 'Transaksi sudah dibatalkan dan tidak bisa dibatalkan lagi.',
                ]);
            }

            $locked->update([
                'status' => Transaction::STATUS_CANCELLED,
                'cancel_reason' => $request->validated('cancel_reason'),
                'cancelled_by' => $request->user()->id,
                'cancelled_at' => now(),
            ]);

            $this->restoreStock($locked, $request->user()->id);

            $transaction->setRawAttributes($locked->getAttributes());
        });

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_TRANSAKSI,
            'Batalkan Transaksi',
            "Membatalkan transaksi {$transaction->invoice_number}",
        );

        return back()->with(
            'success',
            "Transaksi {$transaction->invoice_number} berhasil dibatalkan.",
        );
    }

    /**
     * Kembalikan stok berdasarkan stock_movement `sale` milik transaksi
     * ini — hanya produk yang stoknya benar-benar dikurangi (track_stock
     * saat transaksi) yang dikembalikan, sesuai qty transaksi (PRD 5.8).
     */
    private function restoreStock(Transaction $transaction, int $userId): void
    {
        $saleMovements = StockMovement::query()
            ->where('reference_type', Transaction::class)
            ->where('reference_id', $transaction->id)
            ->where('type', StockMovement::TYPE_SALE)
            ->get();

        foreach ($saleMovements as $movement) {
            // withTrashed: stok produk yang sudah di-soft-delete tetap
            // dikembalikan agar log pergerakan stok konsisten
            $product = Product::withTrashed()
                ->whereKey($movement->product_id)
                ->lockForUpdate()
                ->firstOrFail();

            $quantity = -$movement->quantity_change; // sale bernilai negatif
            $stockBefore = $product->stock;

            $product->update(['stock' => $stockBefore + $quantity]);

            StockMovement::create([
                'product_id' => $product->id,
                'user_id' => $userId,
                'type' => StockMovement::TYPE_ADJUSTMENT,
                'reference_type' => Transaction::class,
                'reference_id' => $transaction->id,
                'quantity_change' => $quantity,
                'stock_before' => $stockBefore,
                'stock_after' => $product->stock,
                'reason' => 'Pembatalan transaksi '.$transaction->invoice_number,
            ]);
        }
    }

    /**
     * Payload detail + cetak ulang struk — superset dari data struk
     * Fase 5, seluruhnya dari snapshot (PRD 5.5 & 5.11).
     *
     * @return array<string, mixed>
     */
    private function detailPayload(Transaction $transaction): array
    {
        $transaction->load('items', 'user', 'cancelledBy');

        $methodLabel = PaymentMethod::query()
            ->where('code', $transaction->payment_method)
            ->value('name') ?? $transaction->payment_method;

        return [
            'id' => $transaction->id,
            'invoice_number' => $transaction->invoice_number,
            'date' => $transaction->created_at->toIso8601String(),
            'kasir' => $transaction->user->name,
            'items' => $transaction->items->map(fn ($item) => [
                'product_name' => $item->product_name,
                'price' => $item->price,
                'quantity' => $item->quantity,
                'subtotal' => $item->subtotal,
                'note' => $item->note,
            ])->all(),
            'subtotal' => $transaction->subtotal,
            'discount' => $transaction->discount,
            'tax_name' => $transaction->tax_name,
            'tax_percent' => $transaction->tax_percent,
            'tax_amount' => $transaction->tax_amount,
            'rounding' => $transaction->rounding,
            'total' => $transaction->total,
            'payment_method' => $transaction->payment_method,
            'payment_method_label' => $methodLabel,
            'paid_amount' => $transaction->paid_amount,
            'change_amount' => $transaction->change_amount,
            'customer_phone' => $transaction->customer_phone,
            'status' => $transaction->status,
            'cancel_reason' => $transaction->cancel_reason,
            'cancelled_by' => $transaction->cancelledBy?->name,
            'cancelled_at' => $transaction->cancelled_at?->toIso8601String(),
        ];
    }

    /**
     * Filter tanggal: param tidak dikirim → default hari ini;
     * dikirim kosong/tidak valid → tanpa batas (semua tanggal).
     */
    private function dateFilter(Request $request, string $key): ?CarbonImmutable
    {
        if (! $request->has($key)) {
            return CarbonImmutable::today();
        }

        $value = (string) $request->query($key, '');

        return rescue(
            fn () => $value !== '' ? CarbonImmutable::parse($value) : null,
            null,
            report: false,
        );
    }

    /**
     * Profil Toko untuk header & footer struk (PRD 5.5) — sama seperti
     * layar Kasir agar cetak ulang memakai template Fase 5.
     *
     * @return array<string, string|null>
     */
    private function receiptProfile(): array
    {
        $settings = Setting::asArray();

        return [
            'name' => ($settings['store_name'] ?? null) ?: 'Pitou Cafe',
            'logo' => ($settings['store_logo'] ?? null)
                ? Storage::disk('public')->url($settings['store_logo'])
                : null,
            'address' => $settings['store_address'] ?? null,
            'phone' => $settings['store_phone'] ?? null,
            'footer' => $settings['receipt_footer'] ?? null,
        ];
    }
}
