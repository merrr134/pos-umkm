<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProductTest extends TestCase
{
    use RefreshDatabase;

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Es Kopi Susu',
            'category_id' => Category::factory()->create()->id,
            'barcode' => '',
            'price' => 18000,
            'description' => 'Kopi susu dengan es batu',
            'status' => 'aktif',
            'track_stock' => false,
        ], $overrides);
    }

    public function test_owner_and_admin_can_view_produk_page(): void
    {
        $this->actingAs(User::factory()->owner()->create())
            ->get('/produk')->assertOk();

        $this->actingAs(User::factory()->admin()->create())
            ->get('/produk')->assertOk();
    }

    public function test_kasir_cannot_view_produk_page(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/produk')->assertForbidden();
    }

    public function test_owner_can_create_product_without_stock_tracking(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)
            ->post('/produk', $this->validPayload());

        $response->assertRedirect()->assertSessionHas('success');
        $this->assertDatabaseHas('products', [
            'name' => 'Es Kopi Susu',
            'price' => 18000,
            'track_stock' => false,
            'stock' => 0,
            'min_stock' => 0,
        ]);
    }

    public function test_product_with_stock_tracking_stores_stock_fields(): void
    {
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)->post('/produk', $this->validPayload([
            'track_stock' => true,
            'stock' => 45,
            'min_stock' => 5,
        ]))->assertSessionHasNoErrors();

        $this->assertDatabaseHas('products', [
            'name' => 'Es Kopi Susu',
            'track_stock' => true,
            'stock' => 45,
            'min_stock' => 5,
        ]);
    }

    public function test_stock_is_required_when_tracking_enabled(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/produk', $this->validPayload([
            'track_stock' => true,
        ]));

        $response->assertSessionHasErrors('stock');
    }

    public function test_negative_stock_is_rejected(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/produk', $this->validPayload([
            'track_stock' => true,
            'stock' => -1,
        ]));

        $response->assertSessionHasErrors('stock');
    }

    public function test_name_category_and_price_are_required(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/produk', [
            'name' => '',
            'category_id' => '',
            'price' => '',
            'status' => 'aktif',
            'track_stock' => false,
        ]);

        $response->assertSessionHasErrors(['name', 'category_id', 'price']);
    }

    public function test_price_must_be_greater_than_zero(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)
            ->post('/produk', $this->validPayload(['price' => 0]));

        $response->assertSessionHasErrors('price');
    }

    public function test_barcode_is_optional(): void
    {
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)->post('/produk', $this->validPayload())
            ->assertSessionHasNoErrors();

        $this->actingAs($owner)->post('/produk', $this->validPayload([
            'name' => 'Produk Kedua',
        ]))->assertSessionHasNoErrors();

        $this->assertSame(2, Product::count());
    }

    public function test_barcode_must_be_unique_when_filled(): void
    {
        $owner = User::factory()->owner()->create();
        Product::factory()->create(['barcode' => 'SKU-001']);

        $response = $this->actingAs($owner)->post('/produk', $this->validPayload([
            'barcode' => 'SKU-001',
        ]));

        $response->assertSessionHasErrors('barcode');
    }

    public function test_barcode_unique_rule_ignores_own_product_on_update(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::factory()->create(['barcode' => 'SKU-001']);

        $response = $this->actingAs($owner)->put(
            "/produk/{$product->id}",
            $this->validPayload(['barcode' => 'SKU-001']),
        );

        $response->assertSessionHasNoErrors();
    }

    public function test_photo_can_be_uploaded(): void
    {
        Storage::fake('public');
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/produk', $this->validPayload([
            'photo' => UploadedFile::fake()->image('produk.png', 300, 300),
        ]));

        $response->assertSessionHasNoErrors();

        $product = Product::first();
        $this->assertNotNull($product->photo);
        Storage::disk('public')->assertExists($product->photo);
    }

    public function test_photo_larger_than_2mb_is_rejected(): void
    {
        Storage::fake('public');
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/produk', $this->validPayload([
            'photo' => UploadedFile::fake()->image('produk.png')->size(2049),
        ]));

        $response->assertSessionHasErrors('photo');
    }

    public function test_photo_with_invalid_format_is_rejected(): void
    {
        Storage::fake('public');
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/produk', $this->validPayload([
            'photo' => UploadedFile::fake()->create('produk.pdf', 100, 'application/pdf'),
        ]));

        $response->assertSessionHasErrors('photo');
    }

    public function test_new_photo_replaces_old_photo_file(): void
    {
        Storage::fake('public');
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)->post('/produk', $this->validPayload([
            'photo' => UploadedFile::fake()->image('lama.png'),
        ]));
        $product = Product::first();
        $oldPhoto = $product->photo;

        $this->actingAs($owner)->put(
            "/produk/{$product->id}",
            $this->validPayload(['photo' => UploadedFile::fake()->image('baru.png')]),
        );

        $newPhoto = $product->fresh()->photo;
        $this->assertNotSame($oldPhoto, $newPhoto);
        Storage::disk('public')->assertMissing($oldPhoto);
        Storage::disk('public')->assertExists($newPhoto);
    }

    public function test_owner_can_update_product(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::factory()->create();

        $response = $this->actingAs($owner)->put(
            "/produk/{$product->id}",
            $this->validPayload(['name' => 'Cappuccino', 'price' => 20000]),
        );

        $response->assertRedirect()->assertSessionHasNoErrors();

        $product->refresh();
        $this->assertSame('Cappuccino', $product->name);
        $this->assertSame(20000, $product->price);
    }

    public function test_disabling_stock_tracking_resets_stock_fields(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::factory()->tracked(45, 5)->create();

        $this->actingAs($owner)->put(
            "/produk/{$product->id}",
            $this->validPayload(['track_stock' => false]),
        )->assertSessionHasNoErrors();

        $product->refresh();
        $this->assertFalse($product->track_stock);
        $this->assertSame(0, $product->stock);
        $this->assertSame(0, $product->min_stock);
    }

    public function test_deleting_product_uses_soft_delete(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::factory()->create();

        $response = $this->actingAs($owner)->delete("/produk/{$product->id}");

        $response->assertRedirect()->assertSessionHas('success');
        $this->assertSoftDeleted('products', ['id' => $product->id]);
    }

    public function test_products_can_be_searched_and_filtered_by_category(): void
    {
        $owner = User::factory()->owner()->create();
        $kopi = Category::factory()->create(['name' => 'Kopi']);
        $makanan = Category::factory()->create(['name' => 'Makanan']);
        Product::factory()->for($kopi)->create(['name' => 'Es Kopi Susu']);
        Product::factory()->for($kopi)->create(['name' => 'Latte']);
        Product::factory()->for($makanan)->create(['name' => 'Brownies']);

        $this->actingAs($owner)->get('/produk?search=kopi')->assertInertia(
            fn ($page) => $page->where('products.total', 1),
        );

        $this->actingAs($owner)->get("/produk?category={$kopi->id}")->assertInertia(
            fn ($page) => $page->where('products.total', 2),
        );
    }

    public function test_products_can_be_filtered_by_status(): void
    {
        $owner = User::factory()->owner()->create();
        Product::factory()->count(2)->create();
        Product::factory()->habis()->create();

        $this->actingAs($owner)->get('/produk?status=habis')->assertInertia(
            fn ($page) => $page->where('products.total', 1),
        );

        $this->actingAs($owner)->get('/produk?status=aktif')->assertInertia(
            fn ($page) => $page->where('products.total', 2),
        );
    }

    public function test_index_provides_product_stats(): void
    {
        $owner = User::factory()->owner()->create();
        Product::factory()->count(2)->create();
        Product::factory()->habis()->create();
        Product::factory()->tracked(0)->create();

        $this->actingAs($owner)->get('/produk')->assertInertia(
            fn ($page) => $page
                ->where('stats.total', 4)
                ->where('stats.aktif', 3)
                ->where('stats.stok_habis', 2)
                ->where('stats.kategori', 4),
        );
    }

    public function test_sellable_scope_excludes_habis_and_out_of_stock(): void
    {
        $sellable = Product::factory()->create();
        $sellableTracked = Product::factory()->tracked(5)->create();
        Product::factory()->habis()->create();
        Product::factory()->tracked(0)->create();

        $ids = Product::sellable()->pluck('id');

        $this->assertEqualsCanonicalizing(
            [$sellable->id, $sellableTracked->id],
            $ids->all(),
        );
    }
}
