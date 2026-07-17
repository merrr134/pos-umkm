<?php

namespace Database\Factories;

use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Supplier>
 */
class SupplierFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        static $sequence = 0;

        return [
            'code' => 'SUP-'.str_pad((string) ++$sequence, 4, '0', STR_PAD_LEFT),
            'name' => fake()->company(),
            'contact_person' => fake()->name(),
            'phone' => fake()->numerify('08##########'),
            'email' => fake()->unique()->safeEmail(),
            'address' => fake()->address(),
            'notes' => null,
            'status' => Supplier::STATUS_AKTIF,
        ];
    }

    /** Supplier berstatus nonaktif. */
    public function nonaktif(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => Supplier::STATUS_NONAKTIF,
        ]);
    }
}
