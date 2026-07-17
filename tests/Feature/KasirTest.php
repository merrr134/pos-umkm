<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KasirTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_roles_can_view_kasir_page_with_products(): void
    {
        Product::factory()->count(2)->create();

        foreach (['owner', 'admin', 'kasir'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)->get('/kasir')
                ->assertOk()
                ->assertInertia(
                    fn ($page) => $page
                        ->component('Kasir/Index')
                        ->has('products.data', 2)
                        ->has('categories'),
                );
        }
    }

    public function test_habis_and_out_of_stock_products_are_marked_unsellable(): void
    {
        $kasir = User::factory()->create();
        Product::factory()->create(['name' => 'Tersedia']);
        Product::factory()->habis()->create(['name' => 'Habis']);
        Product::factory()->tracked(0)->create(['name' => 'Stok Nol']);

        $response = $this->actingAs($kasir)->get('/kasir');

        $response->assertInertia(
            fn ($page) => $page
                ->where('products.data.0.name', 'Habis')
                ->where('products.data.0.sellable', false)
                ->where('products.data.1.name', 'Stok Nol')
                ->where('products.data.1.sellable', false)
                ->where('products.data.2.name', 'Tersedia')
                ->where('products.data.2.sellable', true),
        );
    }

    public function test_products_can_be_searched_case_insensitively(): void
    {
        $kasir = User::factory()->create();
        Product::factory()->create(['name' => 'Es Kopi Susu']);
        Product::factory()->create(['name' => 'Brownies']);

        $this->actingAs($kasir)->get('/kasir?search=KOPI')->assertInertia(
            fn ($page) => $page
                ->has('products.data', 1)
                ->where('products.data.0.name', 'Es Kopi Susu'),
        );
    }

    public function test_products_can_be_searched_by_barcode(): void
    {
        $kasir = User::factory()->create();
        Product::factory()->create(['name' => 'Latte', 'barcode' => 'SKU-777']);
        Product::factory()->create(['name' => 'Croissant']);

        $this->actingAs($kasir)->get('/kasir?search=SKU-777')->assertInertia(
            fn ($page) => $page
                ->has('products.data', 1)
                ->where('products.data.0.name', 'Latte'),
        );
    }

    public function test_products_can_be_filtered_by_category(): void
    {
        $kasir = User::factory()->create();
        $kopi = Category::factory()->create(['name' => 'Kopi']);
        Product::factory()->for($kopi)->count(2)->create();
        Product::factory()->create();

        $this->actingAs($kasir)->get("/kasir?category={$kopi->id}")->assertInertia(
            fn ($page) => $page->has('products.data', 2),
        );
    }

    public function test_calculate_returns_subtotal_and_total(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['price' => 18000]);

        $response = $this->actingAs($kasir)->postJson('/kasir/hitung', [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
        ]);

        $response->assertOk()->assertJson([
            'subtotal' => 36000,
            'discount' => 0,
            'tax' => 0,
            'total' => 36000,
        ]);
    }

    public function test_calculate_applies_nominal_discount_capped_at_subtotal(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['price' => 10000]);

        $response = $this->actingAs($kasir)->postJson('/kasir/hitung', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'discount_type' => 'nominal',
            'discount_value' => 15000,
        ]);

        $response->assertOk()->assertJson([
            'subtotal' => 10000,
            'discount' => 10000,
            'total' => 0,
        ]);
    }

    public function test_calculate_applies_percent_discount(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['price' => 20000]);

        $response = $this->actingAs($kasir)->postJson('/kasir/hitung', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'discount_type' => 'percent',
            'discount_value' => 10,
        ]);

        $response->assertOk()->assertJson([
            'subtotal' => 40000,
            'discount' => 4000,
            'total' => 36000,
        ]);
    }

    public function test_calculate_rejects_quantity_exceeding_stock(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->tracked(3)->create();

        $response = $this->actingAs($kasir)->postJson('/kasir/hitung', [
            'items' => [['product_id' => $product->id, 'quantity' => 4]],
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('items');
    }

    public function test_calculate_rejects_unsellable_product(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->habis()->create();

        $response = $this->actingAs($kasir)->postJson('/kasir/hitung', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('items');
    }

    public function test_calculate_requires_items(): void
    {
        $kasir = User::factory()->create();

        $this->actingAs($kasir)->postJson('/kasir/hitung', [
            'items' => [],
        ])->assertUnprocessable()->assertJsonValidationErrors('items');
    }

    public function test_guest_cannot_access_kasir_endpoints(): void
    {
        $this->get('/kasir')->assertRedirect('/login');
        $this->postJson('/kasir/hitung', ['items' => []])->assertUnauthorized();
    }
}
