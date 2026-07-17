<?php

namespace App\Http\Controllers;

use App\Http\Requests\RestockRequest;
use App\Http\Requests\StockAdjustmentRequest;
use App\Models\Category;
use App\Models\Product;
use App\Models\StockMovement;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StokController extends Controller
{
    /**
     * Halaman Manajemen Stok (Fase 7 — PRD 5.8, sub-tab Produk).
     * Semua produk + status level stok; filter search/kategori/status;
     * kartu statistik. Kasir hanya melihat (view only).
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $categoryId = $request->query('category');
        $stockStatus = $request->query('stock_status');

        $products = Product::query()
            ->with('category:id,name')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('barcode', 'like', "%{$search}%");
                });
            })
            ->when($categoryId, fn ($query, $categoryId) => $query->where('category_id', $categoryId))
            ->when(
                in_array($stockStatus, ['normal', 'menipis', 'habis'], true),
                fn ($query) => $this->applyStockStatus($query, $stockStatus),
            )
            ->orderBy('name')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'photo_url' => $product->photo_url,
                'category' => $product->category?->name,
                'track_stock' => $product->track_stock,
                'stock' => $product->stock,
                'min_stock' => $product->min_stock,
                'stock_status' => $product->stockStatus(),
            ]);

        // Statistik level stok — satu query agregat (Fase 7)
        $stats = Product::query()
            ->selectRaw('count(*) as total')
            ->selectRaw('sum(case when track_stock = 1 and stock > 0 and (min_stock = 0 or stock > min_stock) then 1 else 0 end) as normal')
            ->selectRaw('sum(case when track_stock = 1 and stock > 0 and min_stock > 0 and stock <= min_stock then 1 else 0 end) as menipis')
            ->selectRaw('sum(case when track_stock = 1 and stock <= 0 then 1 else 0 end) as habis')
            ->first();

        return Inertia::render('Stok/Index', [
            'products' => $products,
            'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
            'filters' => [
                'search' => $search,
                'category' => $categoryId !== null ? (int) $categoryId : null,
                'stock_status' => $stockStatus,
            ],
            'stats' => [
                'total' => (int) $stats->total,
                'normal' => (int) $stats->normal,
                'menipis' => (int) $stats->menipis,
                'habis' => (int) $stats->habis,
            ],
        ]);
    }

    /**
     * Riwayat pergerakan stok (PRD 5.8) — JSON paginated,
     * filter produk + rentang tanggal. Append-only, urut terbaru.
     */
    public function movements(Request $request): JsonResponse
    {
        $productId = $request->query('product');
        $dateFrom = $this->parseDate($request->query('date_from'));
        $dateTo = $this->parseDate($request->query('date_to'));

        $movements = StockMovement::query()
            ->with([
                // withTrashed: riwayat produk/user yang sudah di-soft-delete
                // tetap tampil utuh (log tak boleh putus, DATABASE.md §3.7)
                'product' => fn ($query) => $query->withTrashed()->select('id', 'name'),
                'user' => fn ($query) => $query->withTrashed()->select('id', 'name'),
            ])
            ->when($productId, fn ($query, $productId) => $query->where('product_id', $productId))
            ->when($dateFrom !== null, fn ($query) => $query->where('created_at', '>=', $dateFrom->startOfDay()))
            ->when($dateTo !== null, fn ($query) => $query->where('created_at', '<=', $dateTo->endOfDay()))
            ->latest()
            ->latest('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (StockMovement $movement) => [
                'id' => $movement->id,
                'date' => $movement->created_at->toIso8601String(),
                'product' => $movement->product->name,
                'type' => $movement->type,
                'quantity_change' => $movement->quantity_change,
                'stock_before' => $movement->stock_before,
                'stock_after' => $movement->stock_after,
                'user' => $movement->user->name,
                'reason' => $movement->reason,
            ]);

        return response()->json($movements);
    }

    /**
     * Penyesuaian stok manual / stock opname (PRD 5.8) — Owner & Admin.
     * Tambah/kurang + alasan wajib; atomic dengan lockForUpdate();
     * stok tidak boleh negatif.
     */
    public function adjust(StockAdjustmentRequest $request, Product $product): RedirectResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($request, $product, $data) {
            $locked = $this->lockAdjustableProduct($product);

            $delta = $data['type'] === 'tambah'
                ? (int) $data['quantity']
                : -(int) $data['quantity'];

            $stockBefore = $locked->stock;
            $stockAfter = $stockBefore + $delta;

            if ($stockAfter < 0) {
                throw ValidationException::withMessages([
                    'quantity' => "Pengurangan melebihi stok saat ini (sisa {$stockBefore}).",
                ]);
            }

            $locked->update(['stock' => $stockAfter]);

            StockMovement::create([
                'product_id' => $locked->id,
                'user_id' => $request->user()->id,
                'type' => StockMovement::TYPE_ADJUSTMENT,
                'reference_type' => null,
                'reference_id' => null,
                'quantity_change' => $delta,
                'stock_before' => $stockBefore,
                'stock_after' => $stockAfter,
                'reason' => $data['reason'],
            ]);
        });

        return back()->with('success', "Stok {$product->name} berhasil disesuaikan.");
    }

    /**
     * Restock manual (Fase 7) — Owner & Admin. Menambah stok +
     * stock_movement type restock; atomic dengan lockForUpdate().
     */
    public function restock(RestockRequest $request, Product $product): RedirectResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($request, $product, $data) {
            $locked = $this->lockAdjustableProduct($product);

            $quantity = (int) $data['quantity'];
            $stockBefore = $locked->stock;

            $locked->update(['stock' => $stockBefore + $quantity]);

            StockMovement::create([
                'product_id' => $locked->id,
                'user_id' => $request->user()->id,
                'type' => StockMovement::TYPE_RESTOCK,
                'reference_type' => null,
                'reference_id' => null,
                'quantity_change' => $quantity,
                'stock_before' => $stockBefore,
                'stock_after' => $locked->stock,
                'reason' => ($data['note'] ?? '') !== '' ? $data['note'] : null,
            ]);
        });

        return back()->with('success', "Stok {$product->name} berhasil ditambahkan.");
    }

    /**
     * Kunci baris produk (anti race condition) dan tolak produk yang
     * tidak mengelola stok — track_stock=false tidak boleh di-adjust.
     */
    private function lockAdjustableProduct(Product $product): Product
    {
        $locked = Product::query()
            ->whereKey($product->id)
            ->lockForUpdate()
            ->firstOrFail();

        if (! $locked->track_stock) {
            throw ValidationException::withMessages([
                'quantity' => "Produk {$locked->name} tidak mengelola stok (Kelola Stok nonaktif).",
            ]);
        }

        return $locked;
    }

    /**
     * Terjemahan status level stok ke kondisi query — cermin
     * Product::stockStatus().
     */
    private function applyStockStatus(Builder $query, string $status): Builder
    {
        return match ($status) {
            'habis' => $query->where('track_stock', true)->where('stock', '<=', 0),
            'menipis' => $query->where('track_stock', true)
                ->where('stock', '>', 0)
                ->where('min_stock', '>', 0)
                ->whereColumn('stock', '<=', 'min_stock'),
            default => $query->where('track_stock', true)
                ->where('stock', '>', 0)
                ->where(function ($query) {
                    $query->where('min_stock', 0)
                        ->orWhereColumn('stock', '>', 'min_stock');
                }),
        };
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
