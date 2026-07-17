<?php

namespace Database\Factories;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Expense>
 */
class ExpenseFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'expense_category_id' => ExpenseCategory::factory(),
            'expense_number' => 'EXP-TEST-'.strtoupper(Str::random(10)),
            'expense_date' => now()->toDateString(),
            'title' => fake()->words(3, true),
            'amount' => fake()->numberBetween(10_000, 500_000),
            'payment_method' => 'tunai',
            'notes' => null,
            'receipt_path' => null,
        ];
    }
}
