<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_and_admin_can_view_kategori_page(): void
    {
        $this->actingAs(User::factory()->owner()->create())
            ->get('/kategori')->assertOk();

        $this->actingAs(User::factory()->admin()->create())
            ->get('/kategori')->assertOk();
    }

    public function test_kasir_cannot_view_kategori_page(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/kategori')->assertForbidden();
    }

    public function test_owner_can_create_category(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/kategori', [
            'name' => 'Kopi',
        ]);

        $response->assertRedirect()->assertSessionHas('success');
        $this->assertDatabaseHas('categories', ['name' => 'Kopi']);
    }

    public function test_category_name_is_required(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/kategori', [
            'name' => '',
        ]);

        $response->assertSessionHasErrors('name');
    }

    public function test_category_name_must_be_unique(): void
    {
        $owner = User::factory()->owner()->create();
        Category::factory()->create(['name' => 'Kopi']);

        $response = $this->actingAs($owner)->post('/kategori', [
            'name' => 'Kopi',
        ]);

        $response->assertSessionHasErrors('name');
        $this->assertSame(1, Category::count());
    }

    public function test_owner_can_update_category(): void
    {
        $owner = User::factory()->owner()->create();
        $category = Category::factory()->create(['name' => 'Kopi']);

        $response = $this->actingAs($owner)->put("/kategori/{$category->id}", [
            'name' => 'Non Kopi',
        ]);

        $response->assertRedirect()->assertSessionHasNoErrors();
        $this->assertSame('Non Kopi', $category->fresh()->name);
    }

    public function test_update_unique_rule_ignores_own_name(): void
    {
        $owner = User::factory()->owner()->create();
        $category = Category::factory()->create(['name' => 'Kopi']);

        $response = $this->actingAs($owner)->put("/kategori/{$category->id}", [
            'name' => 'Kopi',
        ]);

        $response->assertSessionHasNoErrors();
    }

    public function test_owner_can_soft_delete_unused_category(): void
    {
        $owner = User::factory()->owner()->create();
        $category = Category::factory()->create();

        $response = $this->actingAs($owner)
            ->delete("/kategori/{$category->id}");

        $response->assertRedirect()->assertSessionHas('success');
        $this->assertSoftDeleted('categories', ['id' => $category->id]);
    }

    public function test_category_used_by_product_cannot_be_deleted(): void
    {
        $owner = User::factory()->owner()->create();
        $category = Category::factory()->create();
        Product::factory()->for($category)->create();

        $response = $this->actingAs($owner)
            ->delete("/kategori/{$category->id}");

        $response->assertSessionHasErrors('category');
        $this->assertNull($category->fresh()->deleted_at);
    }

    public function test_category_used_by_soft_deleted_product_cannot_be_deleted(): void
    {
        $owner = User::factory()->owner()->create();
        $category = Category::factory()->create();
        $product = Product::factory()->for($category)->create();
        $product->delete();

        $response = $this->actingAs($owner)
            ->delete("/kategori/{$category->id}");

        $response->assertSessionHasErrors('category');
        $this->assertNull($category->fresh()->deleted_at);
    }

    public function test_kategori_list_can_be_searched(): void
    {
        $owner = User::factory()->owner()->create();
        Category::factory()->create(['name' => 'Kopi']);
        Category::factory()->create(['name' => 'Makanan']);

        $response = $this->actingAs($owner)->get('/kategori?search=kopi');

        $response->assertOk()->assertInertia(
            fn ($page) => $page
                ->where('categories.total', 1)
                ->where('categories.data.0.name', 'Kopi'),
        );
    }
}
