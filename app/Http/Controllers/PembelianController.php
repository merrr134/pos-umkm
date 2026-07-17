<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePurchaseRequest;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Services\ActivityLogService;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PembelianController extends Controller
{
    /**
     * Batas retry saat nomor pembelian bentrok (unique index) —
     * DATABASE.md Bab 10, pola sama dengan nomor transaksi.
     */
    private const MAX_INVOICE_RETRY = 5;

    /**
     * Halaman Pembelian (Fase 9 — PRD 5.9): paginated, filter
     * tanggal/supplier + search nomor/nama supplier, kartu statistik.
     * Kasir view only. Pembelian append-only — tidak ada edit/hapus.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $supplierId = $request->query('supplier');
        $dateFrom = $this->parseDate($request->query('date_from'));
        $dateTo = $this->parseDate($request->query('date_to'));

        $purchases = Purchase::query()
            ->with([
                // withTrashed: pembelian dari supplier terhapus tetap tampil
                'supplier' => fn ($query) => $query->withTrashed()->select('id', 'code', 'name'),
                'user' => fn ($query) => $query->withTrashed()->select('id', 'name'),
            ])
            ->withCount('items')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('invoice_number', 'like', "%{$search}%")
                        ->orWhereHas('supplier', function ($query) use ($search) {
                            $query->withTrashed()->where('name', 'like', "%{$search}%");
                        });
                });
            })
            ->when($supplierId, fn ($query, $supplierId) => $query->where('supplier_id', $supplierId))
            ->when($dateFrom !== null, fn ($query) => $query->where('purchase_date', '>=', $dateFrom->toDateString()))
            ->when($dateTo !== null, fn ($query) => $query->where('purchase_date', '<=', $dateTo->toDateString()))
            ->orderByDesc('purchase_date')
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Purchase $purchase) => [
                'id' => $purchase->id,
                'invoice_number' => $purchase->invoice_number,
                'purchase_date' => $purchase->purchase_date->toDateString(),
                'supplier' => $purchase->supplier->name,
                'items_count' => $purchase->items_count,
                'total' => $purchase->total,
                'user' => $purchase->user->name,
            ]);

        $isKasir = $request->user()->role === 'kasir';

        return Inertia::render('Pembelian/Index', [
            'purchases' => $purchases,
            'filters' => [
                'search' => $search,
                'supplier' => $supplierId !== null ? (int) $supplierId : null,
                'date_from' => $dateFrom?->toDateString() ?? '',
                'date_to' => $dateTo?->toDateString() ?? '',
            ],
            'suppliers' => Supplier::query()
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'status']),
            // Form pembelian hanya untuk Owner/Admin; hanya produk
            // ber-kelola-stok yang bisa dibeli (track_stock=true)
            'products' => $isKasir
                ? []
                : Product::query()
                    ->where('track_stock', true)
                    ->orderBy('name')
                    ->get(['id', 'name', 'cost_price', 'stock']),
            'stats' => [
                'total' => Purchase::count(),
                'hari_ini' => Purchase::whereDate('purchase_date', now()->toDateString())->count(),
                'bulan_ini' => Purchase::whereBetween('purchase_date', [
                    now()->startOfMonth()->toDateString(),
                    now()->endOfMonth()->toDateString(),
                ])->count(),
                'total_nilai' => (int) Purchase::sum('total'),
            ],
            'can' => [
                'create' => ! $isKasir,
            ],
        ]);
    }

    /**
     * Detail pembelian — JSON untuk modal detail.
     */
    public function show(Purchase $purchase): JsonResponse
    {
        $purchase->load([
            'supplier' => fn ($query) => $query->withTrashed(),
            'user' => fn ($query) => $query->withTrashed(),
            'items.product' => fn ($query) => $query->withTrashed(),
        ]);

        return response()->json([
            'purchase' => [
                'id' => $purchase->id,
                'invoice_number' => $purchase->invoice_number,
                'purchase_date' => $purchase->purchase_date->toDateString(),
                'supplier' => [
                    'code' => $purchase->supplier->code,
                    'name' => $purchase->supplier->name,
                ],
                'user' => $purchase->user->name,
                'items' => $purchase->items->map(fn ($item) => [
                    'product' => $item->product->name,
                    'quantity' => $item->quantity,
                    'cost_price' => $item->cost_price,
                    'subtotal' => $item->subtotal,
                ])->all(),
                'subtotal' => $purchase->subtotal,
                'discount' => $purchase->discount,
                'tax' => $purchase->tax,
                'total' => $purchase->total,
                'notes' => $purchase->notes,
                'created_at' => $purchase->created_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * Simpan pembelian (Fase 9) — atomic dalam DB::transaction():
     * purchases + purchase_items + stok bertambah + cost_price produk
     * diperbarui + stock_movement type purchase. Gagal → rollback semua.
     */
    public function store(StorePurchaseRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $attempt = 0;

        do {
            try {
                $purchase = DB::transaction(
                    fn () => $this->createPurchase($request->user()->id, $data),
                );

                break;
            } catch (UniqueConstraintViolationException $e) {
                if (++$attempt >= self::MAX_INVOICE_RETRY) {
                    throw $e;
                }
            }
        } while (true);

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_PEMBELIAN,
            'Tambah Pembelian',
            "Mencatat pembelian {$purchase->invoice_number} (total {$purchase->total})",
        );

        return back()->with(
            'success',
            "Pembelian {$purchase->invoice_number} berhasil disimpan.",
        );
    }

    /**
     * Business logic inti — dijalankan di dalam DB::transaction().
     *
     * @param  array<string, mixed>  $data
     */
    private function createPurchase(int $userId, array $data): Purchase
    {
        $subtotal = 0;
        $rows = [];

        foreach ($data['items'] as $item) {
            // Kunci baris produk sampai commit (anti race condition)
            $product = Product::query()
                ->whereKey($item['product_id'])
                ->lockForUpdate()
                ->firstOrFail();

            // Produk tanpa kelola stok tidak boleh dibeli (Fase 9)
            if (! $product->track_stock) {
                throw ValidationException::withMessages([
                    'items' => "Produk {$product->name} tidak mengelola stok (Kelola Stok nonaktif).",
                ]);
            }

            $lineSubtotal = (int) $item['cost_price'] * (int) $item['quantity'];
            $subtotal += $lineSubtotal;

            $rows[] = [
                'product' => $product,
                'quantity' => (int) $item['quantity'],
                'cost_price' => (int) $item['cost_price'],
                'subtotal' => $lineSubtotal,
            ];
        }

        $purchase = Purchase::create([
            'supplier_id' => $data['supplier_id'],
            'user_id' => $userId,
            'invoice_number' => Purchase::nextInvoiceNumber(),
            'purchase_date' => $data['purchase_date'],
            'subtotal' => $subtotal,
            'discount' => 0,
            'tax' => 0,
            'total' => $subtotal,
            'notes' => ($data['notes'] ?? '') !== '' ? $data['notes'] : null,
        ]);

        foreach ($rows as $row) {
            /** @var Product $product */
            $product = $row['product'];

            $purchase->items()->create([
                'product_id' => $product->id,
                'quantity' => $row['quantity'],
                'cost_price' => $row['cost_price'],
                'subtotal' => $row['subtotal'],
            ]);

            // Stok bertambah + cost_price = harga beli terbaru (PRD 5.9)
            $stockBefore = $product->stock;
            $product->update([
                'stock' => $stockBefore + $row['quantity'],
                'cost_price' => $row['cost_price'],
            ]);

            StockMovement::create([
                'product_id' => $product->id,
                'user_id' => $userId,
                'type' => StockMovement::TYPE_PURCHASE,
                'reference_type' => Purchase::class,
                'reference_id' => $purchase->id,
                'quantity_change' => $row['quantity'],
                'stock_before' => $stockBefore,
                'stock_after' => $product->stock,
                'reason' => null,
            ]);
        }

        return $purchase;
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
