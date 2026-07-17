<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class StokTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Buat stock_movement langsung — untuk skenario riwayat/filter.
     *
     * @param  array<string, mixed>  $overrides
     */
    private function makeMovement(Product $product, User $user, array $overrides = [], ?Carbon $createdAt = null): StockMovement
    {
        $movement = StockMovement::create(array_merge([
            'product_id' => $product->id,
            'user_id' => $user->id,
            'type' => StockMovement::TYPE_ADJUSTMENT,
            'quantity_change' => 1,
            'stock_before' => 0,
            'stock_after' => 1,
            'reason' => null,
        ], $overrides));

        if ($createdAt !== null) {
            $movement->forceFill(['created_at' => $createdAt])->save();
        }

        return $movement;
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/stok')->assertRedirect('/login');
    }

    public function test_stok_page_renders_for_all_roles(): void
    {
        foreach (['owner', 'admin', 'kasir'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)
                ->get('/stok')
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Stok/Index')
                    ->has('products')
                    ->has('categories')
                    ->has('stats'));
        }
    }

    public function test_stats_count_stock_levels_correctly(): void
    {
        Product::factory()->create(['track_stock' => true, 'stock' => 10, 'min_stock' => 5]); // normal
        Product::factory()->create(['track_stock' => true, 'stock' => 3, 'min_stock' => 5]);  // menipis
        Product::factory()->create(['track_stock' => true, 'stock' => 0, 'min_stock' => 0]);  // habis
        Product::factory()->create(['track_stock' => false, 'stock' => 0]);                   // tidak dilacak

        $this->actingAs(User::factory()->owner()->create())
            ->get('/stok')
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.total', 4)
                ->where('stats.normal', 1)
                ->where('stats.menipis', 1)
                ->where('stats.habis', 1));
    }

    public function test_products_are_filterable_by_search_and_stock_status(): void
    {
        Product::factory()->create(['name' => 'Es Kopi Susu', 'track_stock' => true, 'stock' => 10, 'min_stock' => 2]);
        Product::factory()->create(['name' => 'Brownies', 'track_stock' => true, 'stock' => 1, 'min_stock' => 5]);

        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)
            ->get('/stok?search=brownies')
            ->assertInertia(fn (Assert $page) => $page
                ->has('products.data', 1)
                ->where('products.data.0.name', 'Brownies'));

        $this->actingAs($owner)
            ->get('/stok?stock_status=menipis')
            ->assertInertia(fn (Assert $page) => $page
                ->has('products.data', 1)
                ->where('products.data.0.name', 'Brownies')
                ->where('products.data.0.stock_status', 'menipis'));

        $this->actingAs($owner)
            ->get('/stok?stock_status=normal')
            ->assertInertia(fn (Assert $page) => $page
                ->has('products.data', 1)
                ->where('products.data.0.name', 'Es Kopi Susu'));
    }

    public function test_products_are_filterable_by_category(): void
    {
        $productA = Product::factory()->create();
        Product::factory()->create();

        $this->actingAs(User::factory()->owner()->create())
            ->get("/stok?category={$productA->category_id}")
            ->assertInertia(fn (Assert $page) => $page
                ->has('products.data', 1)
                ->where('products.data.0.id', $productA->id));
    }

    public function test_owner_can_add_stock_via_adjustment(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::factory()->tracked(10)->create();

        $this->actingAs($owner)
            ->post("/stok/{$product->id}/penyesuaian", [
                'type' => 'tambah',
                'quantity' => 5,
                'reason' => 'Koreksi stock opname',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame(15, $product->fresh()->stock);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'user_id' => $owner->id,
            'type' => StockMovement::TYPE_ADJUSTMENT,
            'quantity_change' => 5,
            'stock_before' => 10,
            'stock_after' => 15,
            'reason' => 'Koreksi stock opname',
        ]);
    }

    public function test_admin_can_reduce_stock_via_adjustment(): void
    {
        $admin = User::factory()->admin()->create();
        $product = Product::factory()->tracked(10)->create();

        $this->actingAs($admin)
            ->post("/stok/{$product->id}/penyesuaian", [
                'type' => 'kurang',
                'quantity' => 4,
                'reason' => 'Barang rusak',
            ])
            ->assertRedirect();

        $this->assertSame(6, $product->fresh()->stock);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'type' => StockMovement::TYPE_ADJUSTMENT,
            'quantity_change' => -4,
            'stock_before' => 10,
            'stock_after' => 6,
            'reason' => 'Barang rusak',
        ]);
    }

    public function test_adjustment_cannot_make_stock_negative(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::factory()->tracked(3)->create();

        $this->actingAs($owner)
            ->from('/stok')
            ->post("/stok/{$product->id}/penyesuaian", [
                'type' => 'kurang',
                'quantity' => 5,
                'reason' => 'Barang hilang',
            ])
            ->assertRedirect('/stok')
            ->assertSessionHasErrors('quantity');

        // Rollback total — stok & movement tidak berubah
        $this->assertSame(3, $product->fresh()->stock);
        $this->assertSame(0, StockMovement::query()->count());
    }

    public function test_adjustment_requires_reason_and_minimum_quantity(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::factory()->tracked(10)->create();

        $this->actingAs($owner)
            ->post("/stok/{$product->id}/penyesuaian", [
                'type' => 'tambah',
                'quantity' => 0,
                'reason' => '',
            ])
            ->assertSessionHasErrors(['quantity', 'reason']);

        $this->assertSame(10, $product->fresh()->stock);
    }

    public function test_untracked_product_cannot_be_adjusted_or_restocked(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::factory()->create(['track_stock' => false, 'stock' => 0]);

        $this->actingAs($owner)
            ->post("/stok/{$product->id}/penyesuaian", [
                'type' => 'tambah',
                'quantity' => 5,
                'reason' => 'Coba adjust',
            ])
            ->assertSessionHasErrors('quantity');

        $this->actingAs($owner)
            ->post("/stok/{$product->id}/restock", ['quantity' => 5])
            ->assertSessionHasErrors('quantity');

        $this->assertSame(0, $product->fresh()->stock);
        $this->assertSame(0, StockMovement::query()->count());
    }

    public function test_kasir_cannot_adjust_or_restock(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->tracked(10)->create();

        $this->actingAs($kasir)
            ->post("/stok/{$product->id}/penyesuaian", [
                'type' => 'tambah',
                'quantity' => 5,
                'reason' => 'Coba adjust',
            ])
            ->assertForbidden();

        $this->actingAs($kasir)
            ->post("/stok/{$product->id}/restock", ['quantity' => 5])
            ->assertForbidden();

        $this->assertSame(10, $product->fresh()->stock);
    }

    public function test_restock_adds_stock_and_records_movement(): void
    {
        $admin = User::factory()->admin()->create();
        $product = Product::factory()->tracked(5)->create();

        $this->actingAs($admin)
            ->post("/stok/{$product->id}/restock", [
                'quantity' => 20,
                'note' => 'Restock dari gudang',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame(25, $product->fresh()->stock);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'user_id' => $admin->id,
            'type' => StockMovement::TYPE_RESTOCK,
            'quantity_change' => 20,
            'stock_before' => 5,
            'stock_after' => 25,
            'reason' => 'Restock dari gudang',
        ]);
    }

    public function test_restock_note_is_optional_and_quantity_minimum_one(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::factory()->tracked(5)->create();

        $this->actingAs($owner)
            ->post("/stok/{$product->id}/restock", ['quantity' => 0])
            ->assertSessionHasErrors('quantity');

        $this->actingAs($owner)
            ->post("/stok/{$product->id}/restock", ['quantity' => 3])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame(8, $product->fresh()->stock);
        $this->assertDatabaseHas('stock_movements', [
            'type' => StockMovement::TYPE_RESTOCK,
            'quantity_change' => 3,
            'reason' => null,
        ]);
    }

    public function test_movements_endpoint_returns_history_filtered_by_product(): void
    {
        $owner = User::factory()->owner()->create();
        $productA = Product::factory()->create();
        $productB = Product::factory()->create();

        $this->makeMovement($productA, $owner, ['reason' => 'Milik A']);
        $this->makeMovement($productB, $owner, ['reason' => 'Milik B']);

        $response = $this->actingAs($owner)
            ->getJson("/stok/riwayat?product={$productA->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.product', $productA->name)
            ->assertJsonPath('data.0.reason', 'Milik A')
            ->assertJsonPath('data.0.user', $owner->name);

        // Bentuk paginator lengkap (pagination di modal riwayat)
        $response->assertJsonStructure(['data', 'current_page', 'last_page', 'total', 'from', 'to']);
    }

    public function test_movements_endpoint_filters_by_date(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::factory()->create();

        $this->makeMovement($product, $owner, ['reason' => 'Kemarin'], now()->subDay());
        $this->makeMovement($product, $owner, ['reason' => 'Hari ini']);

        $today = now()->toDateString();

        $this->actingAs($owner)
            ->getJson("/stok/riwayat?product={$product->id}&date_from={$today}&date_to={$today}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reason', 'Hari ini');
    }

    public function test_movements_endpoint_is_paginated(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::factory()->create();

        for ($i = 0; $i < 12; $i++) {
            $this->makeMovement($product, $owner);
        }

        $this->actingAs($owner)
            ->getJson("/stok/riwayat?product={$product->id}")
            ->assertOk()
            ->assertJsonCount(10, 'data')
            ->assertJsonPath('total', 12)
            ->assertJsonPath('last_page', 2);
    }

    public function test_kasir_can_view_stok_and_movements_read_only(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create();

        $this->makeMovement($product, $kasir);

        $this->actingAs($kasir)->get('/stok')->assertOk();
        $this->actingAs($kasir)
            ->getJson("/stok/riwayat?product={$product->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
