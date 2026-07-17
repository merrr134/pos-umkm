<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'category_id' => Category::factory(),
            'name' => fake()->unique()->words(3, true),
            'barcode' => null,
            'price' => fake()->numberBetween(5, 100) * 1000,
            'cost_price' => null,
            'photo' => null,
            'description' => fake()->optional()->sentence(),
            'status' => Product::STATUS_AKTIF,
            'track_stock' => false,
            'stock' => 0,
            'min_stock' => 0,
        ];
    }

    /**
     * Produk dengan stok dikelola.
     */
    public function tracked(int $stock = 10, int $minStock = 0): static
    {
        return $this->state(fn (array $attributes) => [
            'track_stock' => true,
            'stock' => $stock,
            'min_stock' => $minStock,
        ]);
    }

    /**
     * Produk berstatus habis.
     */
    public function habis(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => Product::STATUS_HABIS,
        ]);
    }
}
