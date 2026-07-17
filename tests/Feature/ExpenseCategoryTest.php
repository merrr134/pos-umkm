<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\User;
use Database\Seeders\ExpenseCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExpenseCategoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_default_categories(): void
    {
        $this->seed(ExpenseCategorySeeder::class);

        $this->assertSame(12, ExpenseCategory::count());

        foreach (['Listrik', 'Gas', 'ATK', 'Maintenance', 'Lainnya'] as $name) {
            $this->assertDatabaseHas('expense_categories', ['name' => $name]);
        }

        // Idempotent — seeding ulang tidak menduplikasi
        $this->seed(ExpenseCategorySeeder::class);
        $this->assertSame(12, ExpenseCategory::count());
    }

    public function test_owner_and_admin_can_create_category_but_kasir_cannot(): void
    {
        $this->actingAs(User::factory()->owner()->create())
            ->post('/pengeluaran/kategori', ['name' => 'Dekorasi', 'is_active' => true])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->actingAs(User::factory()->admin()->create())
            ->post('/pengeluaran/kategori', ['name' => 'Promosi', 'is_active' => true])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->actingAs(User::factory()->create()) // kasir
            ->post('/pengeluaran/kategori', ['name' => 'Ilegal', 'is_active' => true])
            ->assertForbidden();

        $this->assertSame(2, ExpenseCategory::count());
    }

    public function test_category_name_must_be_unique(): void
    {
        $owner = User::factory()->owner()->create();
        ExpenseCategory::factory()->create(['name' => 'Gas']);

        $this->actingAs($owner)
            ->post('/pengeluaran/kategori', ['name' => 'Gas', 'is_active' => true])
            ->assertSessionHasErrors('name');

        $this->assertSame(1, ExpenseCategory::count());
    }

    public function test_category_can_be_renamed_and_deactivated(): void
    {
        $owner = User::factory()->owner()->create();
        $category = ExpenseCategory::factory()->create(['name' => 'Gas']);

        $this->actingAs($owner)
            ->put("/pengeluaran/kategori/{$category->id}", [
                'name' => 'Gas LPG',
                'is_active' => false,
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $fresh = $category->fresh();
        $this->assertSame('Gas LPG', $fresh->name);
        $this->assertFalse($fresh->is_active);
    }

    public function test_unused_category_can_be_deleted_but_used_cannot(): void
    {
        $owner = User::factory()->owner()->create();
        $unused = ExpenseCategory::factory()->create();
        $used = ExpenseCategory::factory()->create();
        $expense = Expense::factory()->create(['expense_category_id' => $used->id]);

        $this->actingAs($owner)
            ->delete("/pengeluaran/kategori/{$unused->id}")
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSoftDeleted('expense_categories', ['id' => $unused->id]);

        // Kategori terpakai — ditolak
        $this->actingAs($owner)
            ->delete("/pengeluaran/kategori/{$used->id}")
            ->assertSessionHasErrors('kategori');

        $this->assertNull($used->fresh()->deleted_at);

        // Tetap ditolak walau pengeluarannya sudah di-soft-delete
        $expense->delete();

        $this->actingAs($owner)
            ->delete("/pengeluaran/kategori/{$used->id}")
            ->assertSessionHasErrors('kategori');

        $this->assertNull($used->fresh()->deleted_at);
    }
}
