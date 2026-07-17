<?php

namespace App\Http\Controllers;

use App\Http\Requests\SupplierRequest;
use App\Models\Supplier;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class SupplierController extends Controller
{
    /**
     * Batas retry saat kode supplier bentrok (unique index) —
     * pola sama dengan nomor transaksi (DATABASE.md Bab 10).
     */
    private const MAX_CODE_RETRY = 5;

    /**
     * Halaman Supplier (Fase 8) — list + search + filter status +
     * pagination, urut nama. Owner dapat melihat daftar terhapus
     * (trash) lewat parameter `trashed=1`.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $status = $request->query('status');
        // Trash hanya untuk Owner; role lain param diabaikan
        $showTrash = $request->boolean('trashed')
            && $request->user()->can('viewTrash', Supplier::class);

        $suppliers = Supplier::query()
            ->when($showTrash, fn ($query) => $query->onlyTrashed())
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('code', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%")
                        ->orWhere('contact_person', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            })
            ->when(
                in_array($status, [Supplier::STATUS_AKTIF, Supplier::STATUS_NONAKTIF], true),
                fn ($query) => $query->where('status', $status),
            )
            ->orderBy('name')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Supplier $supplier) => [
                'id' => $supplier->id,
                'code' => $supplier->code,
                'name' => $supplier->name,
                'contact_person' => $supplier->contact_person,
                'phone' => $supplier->phone,
                'email' => $supplier->email,
                'address' => $supplier->address,
                'notes' => $supplier->notes,
                'status' => $supplier->status,
                'created_at' => $supplier->created_at?->toIso8601String(),
                'deleted_at' => $supplier->deleted_at?->toIso8601String(),
            ]);

        return Inertia::render('Supplier/Index', [
            'suppliers' => $suppliers,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'trashed' => $showTrash,
            ],
            'stats' => [
                'total' => Supplier::count(),
                'aktif' => Supplier::where('status', Supplier::STATUS_AKTIF)->count(),
                'nonaktif' => Supplier::where('status', Supplier::STATUS_NONAKTIF)->count(),
                'terhapus' => Supplier::onlyTrashed()->count(),
            ],
            'can' => [
                'manage' => $request->user()->can('create', Supplier::class),
                // Soft delete & restore & trash — Owner only (SupplierPolicy)
                'delete' => $request->user()->role === User::ROLE_OWNER,
                'viewTrash' => $request->user()->can('viewTrash', Supplier::class),
            ],
        ]);
    }

    /**
     * Tambah supplier — kode `SUP-0001` otomatis di dalam
     * DB::transaction(); bentrok unique index → retry.
     */
    public function store(SupplierRequest $request): RedirectResponse
    {
        Gate::authorize('create', Supplier::class);

        $data = $request->validated();
        $attempt = 0;

        do {
            try {
                DB::transaction(function () use ($data) {
                    Supplier::create([
                        ...$data,
                        'code' => Supplier::nextCode(),
                    ]);
                });

                break;
            } catch (UniqueConstraintViolationException $e) {
                if (++$attempt >= self::MAX_CODE_RETRY) {
                    throw $e;
                }
            }
        } while (true);

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_SUPPLIER,
            'Tambah Supplier',
            "Menambahkan supplier {$data['name']}",
        );

        return back()->with('success', 'Supplier berhasil ditambahkan.');
    }

    /**
     * Edit supplier — seluruh data dapat diubah kecuali kode
     * (kode tidak pernah diterima dari request).
     */
    public function update(SupplierRequest $request, Supplier $supplier): RedirectResponse
    {
        Gate::authorize('update', $supplier);

        $supplier->update($request->validated());

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_SUPPLIER,
            'Edit Supplier',
            "Mengubah supplier {$supplier->name}",
        );

        return back()->with('success', 'Supplier berhasil diperbarui.');
    }

    /**
     * Hapus supplier — selalu soft delete (histori pembelian di fase
     * berikutnya harus tetap utuh). Hanya Owner.
     */
    public function destroy(Request $request, Supplier $supplier): RedirectResponse
    {
        Gate::authorize('delete', $supplier);

        $supplier->delete();

        return back()->with('success', "Supplier {$supplier->name} berhasil dihapus.");
    }

    /**
     * Restore supplier terhapus — hanya Owner (Fase 8).
     */
    public function restore(Request $request, Supplier $supplier): RedirectResponse
    {
        Gate::authorize('restore', $supplier);

        $supplier->restore();

        return back()->with('success', "Supplier {$supplier->name} berhasil dipulihkan.");
    }
}
