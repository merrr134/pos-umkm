<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PembelianTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, mixed> */
    private function payload(Supplier $supplier, array $items, array $overrides = []): array
    {
        return array_merge([
            'supplier_id' => $supplier->id,
            'purchase_date' => now()->toDateString(),
            'notes' => null,
            'items' => $items,
        ], $overrides);
    }

    /**
     * Buat purchase langsung di DB — untuk skenario list/filter.
     *
     * @param  array<string, mixed>  $overrides
     */
    private function makePurchase(User $user, Supplier $supplier, array $overrides = []): Purchase
    {
        return Purchase::create(array_merge([
            'supplier_id' => $supplier->id,
            'user_id' => $user->id,
            'invoice_number' => 'PUR-TEST-'.strtoupper(Str::random(8)),
            'purchase_date' => now()->toDateString(),
            'subtotal' => 10000,
            'discount' => 0,
            'tax' => 0,
            'total' => 10000,
            'notes' => null,
        ], $overrides));
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/pembelian')->assertRedirect('/login');
    }

    public function test_pembelian_page_renders_for_all_roles(): void
    {
        foreach (['owner', 'admin', 'kasir'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)
                ->get('/pembelian')
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Pembelian/Index')
                    ->has('purchases')
                    ->has('suppliers')
                    ->has('stats')
                    ->where('can.create', $role !== 'kasir'));
        }
    }

    public function test_purchase_updates_stock_cost_price_and_records_movement(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create();
        $productA = Product::factory()->tracked(5)->create(['cost_price' => 1000]);
        $productB = Product::factory()->tracked(0)->create(['cost_price' => null]);

        $this->actingAs($owner)
            ->post('/pembelian', $this->payload($supplier, [
                ['product_id' => $productA->id, 'quantity' => 10, 'cost_price' => 8000],
                ['product_id' => $productB->id, 'quantity' => 4, 'cost_price' => 12000],
            ], ['notes' => 'Restock mingguan']))
            ->assertRedirect()
            ->assertSessionHas('success');

        $prefix = 'PUR-'.now()->format('Ymd').'-';

        // 1. purchases tersimpan dengan nomor otomatis & total benar
        $this->assertDatabaseHas('purchases', [
            'supplier_id' => $supplier->id,
            'user_id' => $owner->id,
            'invoice_number' => $prefix.'0001',
            'subtotal' => 128000, // 10×8000 + 4×12000
            'total' => 128000,
            'notes' => 'Restock mingguan',
        ]);

        $purchase = Purchase::firstOrFail();

        // 2. purchase_items tersimpan
        $this->assertDatabaseHas('purchase_items', [
            'purchase_id' => $purchase->id,
            'product_id' => $productA->id,
            'quantity' => 10,
            'cost_price' => 8000,
            'subtotal' => 80000,
        ]);

        // 3. stok bertambah, 4. cost_price = harga modal terbaru
        $this->assertSame(15, $productA->fresh()->stock);
        $this->assertSame(8000, $productA->fresh()->cost_price);
        $this->assertSame(4, $productB->fresh()->stock);
        $this->assertSame(12000, $productB->fresh()->cost_price);

        // 5. stock_movement type purchase tercatat lengkap
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $productA->id,
            'user_id' => $owner->id,
            'type' => StockMovement::TYPE_PURCHASE,
            'reference_type' => Purchase::class,
            'reference_id' => $purchase->id,
            'quantity_change' => 10,
            'stock_before' => 5,
            'stock_after' => 15,
        ]);
        $this->assertSame(2, StockMovement::query()->count());
    }

    public function test_invoice_number_follows_daily_format_and_sequence(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->tracked(0)->create();

        $items = [['product_id' => $product->id, 'quantity' => 1, 'cost_price' => 1000]];

        $this->actingAs($owner)->post('/pembelian', $this->payload($supplier, $items));
        $this->actingAs($owner)->post('/pembelian', $this->payload($supplier, $items));

        $prefix = 'PUR-'.now()->format('Ymd').'-';

        $this->assertDatabaseHas('purchases', ['invoice_number' => $prefix.'0001']);
        $this->assertDatabaseHas('purchases', ['invoice_number' => $prefix.'0002']);
    }

    public function test_admin_can_create_purchase_but_kasir_cannot(): void
    {
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->tracked(0)->create();
        $items = [['product_id' => $product->id, 'quantity' => 2, 'cost_price' => 5000]];

        $this->actingAs(User::factory()->admin()->create())
            ->post('/pembelian', $this->payload($supplier, $items))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->actingAs(User::factory()->create()) // kasir
            ->post('/pembelian', $this->payload($supplier, $items))
            ->assertForbidden();

        $this->assertSame(1, Purchase::count());
        $this->assertSame(2, $product->fresh()->stock);
    }

    public function test_validation_rejects_invalid_payload(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->tracked(0)->create();

        // Supplier kosong
        $this->actingAs($owner)
            ->post('/pembelian', $this->payload($supplier, [
                ['product_id' => $product->id, 'quantity' => 1, 'cost_price' => 1000],
            ], ['supplier_id' => null]))
            ->assertSessionHasErrors('supplier_id');

        // Item kosong
        $this->actingAs($owner)
            ->post('/pembelian', $this->payload($supplier, []))
            ->assertSessionHasErrors('items');

        // Qty nol & harga modal nol
        $this->actingAs($owner)
            ->post('/pembelian', $this->payload($supplier, [
                ['product_id' => $product->id, 'quantity' => 0, 'cost_price' => 0],
            ]))
            ->assertSessionHasErrors(['items.0.quantity', 'items.0.cost_price']);

        // Produk duplikat dalam satu pembelian
        $this->actingAs($owner)
            ->post('/pembelian', $this->payload($supplier, [
                ['product_id' => $product->id, 'quantity' => 1, 'cost_price' => 1000],
                ['product_id' => $product->id, 'quantity' => 2, 'cost_price' => 1000],
            ]))
            ->assertSessionHasErrors(['items.0.product_id', 'items.1.product_id']);

        $this->assertSame(0, Purchase::count());
    }

    public function test_deleted_supplier_is_rejected(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->tracked(0)->create();
        $supplier->delete();

        $this->actingAs($owner)
            ->post('/pembelian', $this->payload($supplier, [
                ['product_id' => $product->id, 'quantity' => 1, 'cost_price' => 1000],
            ]))
            ->assertSessionHasErrors('supplier_id');
    }

    public function test_untracked_product_is_rejected_and_everything_rolls_back(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create();
        $tracked = Product::factory()->tracked(5)->create(['cost_price' => 1000]);
        $untracked = Product::factory()->create(['track_stock' => false, 'stock' => 0]);

        $this->actingAs($owner)
            ->post('/pembelian', $this->payload($supplier, [
                ['product_id' => $tracked->id, 'quantity' => 3, 'cost_price' => 2000],
                ['product_id' => $untracked->id, 'quantity' => 2, 'cost_price' => 3000],
            ]))
            ->assertSessionHasErrors('items');

        // Rollback total — tidak ada data setengah tersimpan
        $this->assertSame(0, Purchase::count());
        $this->assertSame(0, StockMovement::count());
        $this->assertSame(5, $tracked->fresh()->stock);
        $this->assertSame(1000, $tracked->fresh()->cost_price);
    }

    public function test_purchases_are_searchable_by_invoice_and_supplier_name(): void
    {
        $owner = User::factory()->owner()->create();
        $supplierA = Supplier::factory()->create(['name' => 'CV Kopi Nusantara']);
        $supplierB = Supplier::factory()->create(['name' => 'PT Susu Segar']);

        $target = $this->makePurchase($owner, $supplierA, ['invoice_number' => 'PUR-TEST-CARIINI']);
        $this->makePurchase($owner, $supplierB, ['invoice_number' => 'PUR-TEST-LAINNYA']);

        foreach (['CARIINI', 'Kopi Nusantara'] as $keyword) {
            $this->actingAs($owner)
                ->get('/pembelian?search='.urlencode($keyword))
                ->assertInertia(fn (Assert $page) => $page
                    ->has('purchases.data', 1)
                    ->where('purchases.data.0.invoice_number', $target->invoice_number));
        }
    }

    public function test_purchases_are_filterable_by_supplier_and_date(): void
    {
        $owner = User::factory()->owner()->create();
        $supplierA = Supplier::factory()->create();
        $supplierB = Supplier::factory()->create();

        $old = $this->makePurchase($owner, $supplierA, [
            'purchase_date' => now()->subDays(10)->toDateString(),
        ]);
        $recent = $this->makePurchase($owner, $supplierB);

        $this->actingAs($owner)
            ->get("/pembelian?supplier={$supplierA->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->has('purchases.data', 1)
                ->where('purchases.data.0.id', $old->id));

        $from = now()->subDays(2)->toDateString();

        $this->actingAs($owner)
            ->get("/pembelian?date_from={$from}")
            ->assertInertia(fn (Assert $page) => $page
                ->has('purchases.data', 1)
                ->where('purchases.data.0.id', $recent->id));
    }

    public function test_purchase_list_is_paginated(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create();

        for ($i = 0; $i < 12; $i++) {
            $this->makePurchase($owner, $supplier);
        }

        $this->actingAs($owner)
            ->get('/pembelian')
            ->assertInertia(fn (Assert $page) => $page
                ->has('purchases.data', 10)
                ->where('purchases.total', 12));
    }

    public function test_detail_endpoint_returns_purchase_with_items(): void
    {
        $owner = User::factory()->owner()->create();
        $kasir = User::factory()->create();
        $supplier = Supplier::factory()->create(['name' => 'CV Kopi Nusantara']);
        $product = Product::factory()->tracked(0)->create(['name' => 'Biji Kopi Arabika']);

        $this->actingAs($owner)->post('/pembelian', $this->payload($supplier, [
            ['product_id' => $product->id, 'quantity' => 5, 'cost_price' => 20000],
        ], ['notes' => 'Kualitas premium']));

        $purchase = Purchase::firstOrFail();

        // Kasir boleh melihat detail (view only)
        $this->actingAs($kasir)
            ->getJson("/pembelian/{$purchase->id}")
            ->assertOk()
            ->assertJsonPath('purchase.invoice_number', $purchase->invoice_number)
            ->assertJsonPath('purchase.supplier.name', 'CV Kopi Nusantara')
            ->assertJsonPath('purchase.user', $owner->name)
            ->assertJsonPath('purchase.items.0.product', 'Biji Kopi Arabika')
            ->assertJsonPath('purchase.items.0.quantity', 5)
            ->assertJsonPath('purchase.items.0.cost_price', 20000)
            ->assertJsonPath('purchase.total', 100000)
            ->assertJsonPath('purchase.notes', 'Kualitas premium');
    }

    public function test_stats_count_purchases_correctly(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create();

        $this->makePurchase($owner, $supplier, ['total' => 50000]);
        $this->makePurchase($owner, $supplier, [
            'purchase_date' => now()->subMonths(2)->toDateString(),
            'total' => 30000,
        ]);

        $this->actingAs($owner)
            ->get('/pembelian')
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.total', 2)
                ->where('stats.hari_ini', 1)
                ->where('stats.bulan_ini', 1)
                ->where('stats.total_nilai', 80000));
    }

    public function test_purchase_cannot_be_edited_or_deleted(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create();
        $purchase = $this->makePurchase($owner, $supplier);

        // Append-only (DATABASE.md §6) — tidak ada route edit/hapus
        $this->actingAs($owner)
            ->put("/pembelian/{$purchase->id}", [])
            ->assertMethodNotAllowed();

        $this->actingAs($owner)
            ->delete("/pembelian/{$purchase->id}")
            ->assertMethodNotAllowed();
    }
}
