<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class KasirController extends Controller
{
    /**
     * Layar Kasir (POS) — PRD 5.2.
     * Grid produk + search (nama/barcode) + filter kategori + pagination.
     * Produk berstatus habis / stok 0 tetap dikirim dengan flag
     * sellable=false agar card tampil disabled (AC PRD 5.2).
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $categoryId = $request->query('category');

        $products = Product::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('barcode', 'like', "%{$search}%");
                });
            })
            ->when($categoryId, function ($query, $categoryId) {
                $query->where('category_id', $categoryId);
            })
            ->orderBy('name')
            ->paginate(12)
            ->withQueryString()
            ->through(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'price' => $product->price,
                'photo_url' => $product->photo_url,
                'category_id' => $product->category_id,
                'status' => $product->status,
                'track_stock' => $product->track_stock,
                'stock' => $product->stock,
                'sellable' => $product->isSellable(),
            ]);

        $settings = Setting::asArray();

        return Inertia::render('Kasir/Index', [
            'products' => $products,
            'categories' => Category::query()
                ->orderBy('name')
                ->get(['id', 'name']),
            'filters' => [
                'search' => $search,
                'category' => $categoryId !== null ? (int) $categoryId : null,
            ],
            // Fase 5 — modal pembayaran: hanya metode aktif (PRD 5.13.C)
            'paymentMethods' => PaymentMethod::query()
                ->where('is_active', true)
                ->orderBy('id')
                ->get(['id', 'name', 'code']),
            // Pajak & pembulatan dari settings (PRD 5.13.B)
            'taxSettings' => [
                'enabled' => ($settings['tax_enabled'] ?? '0') === '1',
                'name' => $settings['tax_name'] ?? 'Pajak',
                'percent' => (float) ($settings['tax_percent'] ?? 0),
                'rounding_method' => $settings['rounding_method'] ?? 'none',
            ],
            // Profil Toko untuk header & footer struk (PRD 5.5)
            'receiptProfile' => [
                'name' => ($settings['store_name'] ?? null) ?: 'Pitou Cafe',
                'logo' => ($settings['store_logo'] ?? null)
                    ? Storage::disk('public')->url($settings['store_logo'])
                    : null,
                'address' => $settings['store_address'] ?? null,
                'phone' => $settings['store_phone'] ?? null,
                'footer' => $settings['receipt_footer'] ?? null,
            ],
        ]);
    }

    /**
     * Fase 15 — snapshot data Kasir untuk cache offline (IndexedDB,
     * PRD 5.14): SELURUH produk (tanpa pagination) + kategori + metode
     * pembayaran aktif + pajak + profil struk. Bentuk item identik
     * dengan props index() agar layar Kasir offline berfungsi sama.
     */
    public function offlineData(): JsonResponse
    {
        $settings = Setting::asArray();

        return response()->json([
            'products' => Product::query()
                ->orderBy('name')
                ->get()
                ->map(fn (Product $product) => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'price' => $product->price,
                    'photo_url' => $product->photo_url,
                    'category_id' => $product->category_id,
                    'status' => $product->status,
                    'track_stock' => $product->track_stock,
                    'stock' => $product->stock,
                    'sellable' => $product->isSellable(),
                ]),
            'categories' => Category::query()
                ->orderBy('name')
                ->get(['id', 'name']),
            'paymentMethods' => PaymentMethod::query()
                ->where('is_active', true)
                ->orderBy('id')
                ->get(['id', 'name', 'code']),
            'taxSettings' => [
                'enabled' => ($settings['tax_enabled'] ?? '0') === '1',
                'name' => $settings['tax_name'] ?? 'Pajak',
                'percent' => (float) ($settings['tax_percent'] ?? 0),
                'rounding_method' => $settings['rounding_method'] ?? 'none',
            ],
            'receiptProfile' => [
                'name' => ($settings['store_name'] ?? null) ?: 'Pitou Cafe',
                'logo' => ($settings['store_logo'] ?? null)
                    ? Storage::disk('public')->url($settings['store_logo'])
                    : null,
                'address' => $settings['store_address'] ?? null,
                'phone' => $settings['store_phone'] ?? null,
                'footer' => $settings['receipt_footer'] ?? null,
            ],
            'cached_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Hitung ringkasan keranjang — PRD 5.2:
     * Total = (Σ subtotal item − diskon) + pajak + pembulatan.
     * Harga diambil dari DB (bukan dari client); pajak & pembulatan
     * dari settings — cermin perhitungan TransactionController (Fase 5).
     */
    public function calculate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'discount_type' => ['nullable', Rule::in(['nominal', 'percent'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
        ]);

        $subtotal = 0;

        foreach ($data['items'] as $item) {
            $product = Product::query()->findOrFail($item['product_id']);

            if (! $product->isSellable()) {
                throw ValidationException::withMessages([
                    'items' => "Produk {$product->name} sedang tidak tersedia.",
                ]);
            }

            if ($product->track_stock && $item['quantity'] > $product->stock) {
                throw ValidationException::withMessages([
                    'items' => "Stok {$product->name} tidak mencukupi (sisa {$product->stock}).",
                ]);
            }

            $subtotal += $product->price * $item['quantity'];
        }

        $discountValue = (float) ($data['discount_value'] ?? 0);

        $discount = match ($data['discount_type'] ?? null) {
            'percent' => (int) round($subtotal * min($discountValue, 100) / 100),
            'nominal' => min((int) $discountValue, $subtotal),
            default => 0,
        };

        $settings = Setting::asArray();
        $taxEnabled = ($settings['tax_enabled'] ?? '0') === '1';
        $taxPercent = $taxEnabled ? (float) ($settings['tax_percent'] ?? 0) : 0.0;

        $tax = (int) round(($subtotal - $discount) * $taxPercent / 100);
        $totalBeforeRounding = $subtotal - $discount + $tax;
        $rounding = Transaction::calculateRounding(
            $totalBeforeRounding,
            $settings['rounding_method'] ?? 'none',
        );

        return response()->json([
            'subtotal' => $subtotal,
            'discount' => $discount,
            'tax' => $tax,
            'rounding' => $rounding,
            'total' => $totalBeforeRounding + $rounding,
        ]);
    }
}
