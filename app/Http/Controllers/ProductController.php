<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProductRequest;
use App\Models\Category;
use App\Models\Product;
use App\Services\ActivityLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    /**
     * Halaman Produk — list + search + filter kategori + pagination
     * (PRD 5.6, Bab 11).
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $categoryId = $request->query('category');
        $status = $request->query('status');

        $products = Product::query()
            ->with('category:id,name')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('barcode', 'like', "%{$search}%");
                });
            })
            ->when($categoryId, function ($query, $categoryId) {
                $query->where('category_id', $categoryId);
            })
            ->when(in_array($status, [Product::STATUS_AKTIF, Product::STATUS_HABIS], true), function ($query) use ($status) {
                $query->where('status', $status);
            })
            ->latest()
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('Produk/Index', [
            'products' => $products,
            'categories' => Category::query()
                ->orderBy('name')
                ->get(['id', 'name']),
            'filters' => [
                'search' => $search,
                'category' => $categoryId !== null ? (int) $categoryId : null,
                'status' => $status,
            ],
            // Kartu statistik di atas tabel (revisi UI halaman Produk)
            'stats' => [
                'total' => Product::count(),
                'aktif' => Product::where('status', Product::STATUS_AKTIF)->count(),
                'stok_habis' => Product::where(function ($query) {
                    $query->where('status', Product::STATUS_HABIS)
                        ->orWhere(function ($query) {
                            $query->where('track_stock', true)->where('stock', '<=', 0);
                        });
                })->count(),
                'kategori' => Category::count(),
            ],
        ]);
    }

    public function store(ProductRequest $request): RedirectResponse
    {
        $data = $this->prepareData($request);

        if ($request->hasFile('photo')) {
            $data['photo'] = $request->file('photo')->store('products', 'public');
        }

        $product = Product::create($data);

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_PRODUK,
            'Tambah Produk',
            "Menambahkan produk {$product->name}",
        );

        return back()->with('success', 'Produk berhasil ditambahkan.');
    }

    public function update(ProductRequest $request, Product $product): RedirectResponse
    {
        $data = $this->prepareData($request);

        if ($request->hasFile('photo')) {
            $data['photo'] = $request->file('photo')->store('products', 'public');

            if ($product->photo !== null && $product->photo !== $data['photo']) {
                Storage::disk('public')->delete($product->photo);
            }
        }

        $product->update($data);

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_PRODUK,
            'Edit Produk',
            "Mengubah produk {$product->name}",
        );

        return back()->with('success', 'Produk berhasil diperbarui.');
    }

    /**
     * Hapus produk — selalu soft delete (PRD 5.6): riwayat transaksi
     * yang memakai produk ini harus tetap utuh. Foto tidak dihapus
     * agar riwayat/pemulihan tetap punya gambar.
     */
    public function destroy(Product $product): RedirectResponse
    {
        $product->delete();

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_PRODUK,
            'Hapus Produk',
            "Menghapus produk {$product->name}",
        );

        return back()->with('success', 'Produk berhasil dihapus.');
    }

    /**
     * Susun data tersimpan dari request tervalidasi.
     * Kelola Stok OFF → stok & minimum stok direset ke 0 (field
     * disembunyikan di form, PRD 5.6). cost_price tidak pernah
     * diterima dari form (auto dari Pembelian — Fase 8).
     *
     * @return array<string, mixed>
     */
    private function prepareData(ProductRequest $request): array
    {
        $data = $request->validated();
        unset($data['photo']);

        if (! $data['track_stock']) {
            $data['stock'] = 0;
            $data['min_stock'] = 0;
        } else {
            $data['min_stock'] = $data['min_stock'] ?? 0;
        }

        return $data;
    }
}
