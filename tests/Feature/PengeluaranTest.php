<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\User;
use Database\Seeders\PaymentMethodSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PengeluaranTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PaymentMethodSeeder::class);
    }

    /** @return array<string, mixed> */
    private function payload(ExpenseCategory $category, array $overrides = []): array
    {
        return array_merge([
            'expense_date' => now()->toDateString(),
            'expense_category_id' => $category->id,
            'title' => 'Beli gas 3kg',
            'amount' => 25000,
            'payment_method' => 'tunai',
            'notes' => null,
        ], $overrides);
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/pengeluaran')->assertRedirect('/login');
    }

    public function test_pengeluaran_page_renders_for_all_roles(): void
    {
        foreach (['owner', 'admin', 'kasir'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)
                ->get('/pengeluaran')
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Pengeluaran/Index')
                    ->has('expenses')
                    ->has('categories')
                    ->has('payment_methods')
                    ->has('stats')
                    ->where('can.manage', $role !== 'kasir')
                    ->where('can.delete', $role === 'owner')
                    ->where('can.viewTrash', $role === 'owner'));
        }
    }

    public function test_store_creates_expense_with_auto_number_and_auto_user(): void
    {
        $owner = User::factory()->owner()->create();
        $otherUser = User::factory()->create();
        $category = ExpenseCategory::factory()->create();

        $this->actingAs($owner)
            ->post('/pengeluaran', $this->payload($category, [
                'notes' => 'Gas habis mendadak',
                // user_id dari request harus diabaikan (pencatat otomatis)
                'user_id' => $otherUser->id,
            ]))
            ->assertRedirect()
            ->assertSessionHas('success');

        $prefix = 'EXP-'.now()->format('Ymd').'-';

        $this->assertDatabaseHas('expenses', [
            'expense_number' => $prefix.'0001',
            'expense_category_id' => $category->id,
            'title' => 'Beli gas 3kg',
            'amount' => 25000,
            'payment_method' => 'tunai',
            'notes' => 'Gas habis mendadak',
            'user_id' => $owner->id,
        ]);
    }

    public function test_expense_number_follows_daily_format_and_sequence(): void
    {
        $owner = User::factory()->owner()->create();
        $category = ExpenseCategory::factory()->create();

        $this->actingAs($owner)->post('/pengeluaran', $this->payload($category));
        $this->actingAs($owner)->post('/pengeluaran', $this->payload($category));

        $prefix = 'EXP-'.now()->format('Ymd').'-';

        $this->assertDatabaseHas('expenses', ['expense_number' => $prefix.'0001']);
        $this->assertDatabaseHas('expenses', ['expense_number' => $prefix.'0002']);
    }

    public function test_admin_can_create_and_update_but_kasir_cannot(): void
    {
        $admin = User::factory()->admin()->create();
        $kasir = User::factory()->create();
        $category = ExpenseCategory::factory()->create();

        $this->actingAs($admin)
            ->post('/pengeluaran', $this->payload($category))
            ->assertRedirect()
            ->assertSessionHas('success');

        $expense = Expense::firstOrFail();

        $this->actingAs($admin)
            ->put("/pengeluaran/{$expense->id}", $this->payload($category, [
                'title' => 'Beli gas 12kg',
                'amount' => 180000,
            ]))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame('Beli gas 12kg', $expense->fresh()->title);

        $this->actingAs($kasir)
            ->post('/pengeluaran', $this->payload($category))
            ->assertForbidden();

        $this->actingAs($kasir)
            ->put("/pengeluaran/{$expense->id}", $this->payload($category))
            ->assertForbidden();

        $this->assertSame(1, Expense::count());
    }

    public function test_update_never_changes_number_and_original_user(): void
    {
        $owner = User::factory()->owner()->create();
        $admin = User::factory()->admin()->create();
        $category = ExpenseCategory::factory()->create();

        $this->actingAs($owner)->post('/pengeluaran', $this->payload($category));
        $expense = Expense::firstOrFail();

        $this->actingAs($admin)
            ->put("/pengeluaran/{$expense->id}", $this->payload($category, [
                'title' => 'Diedit admin',
            ]))
            ->assertRedirect();

        $fresh = $expense->fresh();
        $this->assertSame($expense->expense_number, $fresh->expense_number);
        $this->assertSame($owner->id, $fresh->user_id); // pencatat asli tetap
        $this->assertSame('Diedit admin', $fresh->title);
    }

    public function test_only_owner_can_soft_delete_and_restore(): void
    {
        $owner = User::factory()->owner()->create();
        $admin = User::factory()->admin()->create();
        $kasir = User::factory()->create();
        $expense = Expense::factory()->create();

        // Admin & Kasir tidak boleh hapus
        $this->actingAs($admin)->delete("/pengeluaran/{$expense->id}")->assertForbidden();
        $this->actingAs($kasir)->delete("/pengeluaran/{$expense->id}")->assertForbidden();

        // Owner: soft delete
        $this->actingAs($owner)
            ->delete("/pengeluaran/{$expense->id}")
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSoftDeleted('expenses', ['id' => $expense->id]);

        // Admin tidak boleh restore
        $this->actingAs($admin)
            ->post("/pengeluaran/{$expense->id}/restore")
            ->assertForbidden();

        // Owner: restore
        $this->actingAs($owner)
            ->post("/pengeluaran/{$expense->id}/restore")
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertNull($expense->fresh()->deleted_at);
    }

    public function test_validation_rejects_invalid_payload(): void
    {
        $owner = User::factory()->owner()->create();

        // Semua field wajib kosong
        $this->actingAs($owner)
            ->post('/pengeluaran', [])
            ->assertSessionHasErrors([
                'expense_date',
                'expense_category_id',
                'title',
                'amount',
                'payment_method',
            ]);

        // Nominal nol & metode nonaktif (kartu default nonaktif)
        $category = ExpenseCategory::factory()->create();

        $this->actingAs($owner)
            ->post('/pengeluaran', $this->payload($category, [
                'amount' => 0,
                'payment_method' => 'kartu',
            ]))
            ->assertSessionHasErrors(['amount', 'payment_method']);

        $this->assertSame(0, Expense::count());
    }

    public function test_inactive_or_deleted_category_is_rejected(): void
    {
        $owner = User::factory()->owner()->create();
        $inactive = ExpenseCategory::factory()->nonaktif()->create();
        $deleted = ExpenseCategory::factory()->create();
        $deleted->delete();

        $this->actingAs($owner)
            ->post('/pengeluaran', $this->payload($inactive))
            ->assertSessionHasErrors('expense_category_id');

        $this->actingAs($owner)
            ->post('/pengeluaran', $this->payload($deleted))
            ->assertSessionHasErrors('expense_category_id');
    }

    public function test_receipt_upload_is_stored(): void
    {
        Storage::fake('public');

        $owner = User::factory()->owner()->create();
        $category = ExpenseCategory::factory()->create();

        $this->actingAs($owner)
            ->post('/pengeluaran', $this->payload($category, [
                'receipt' => UploadedFile::fake()->image('bukti.jpg'),
            ]))
            ->assertRedirect()
            ->assertSessionHas('success');

        $expense = Expense::firstOrFail();

        $this->assertNotNull($expense->receipt_path);
        Storage::disk('public')->assertExists($expense->receipt_path);
        $this->assertFalse($expense->receiptIsPdf());

        // PDF juga diterima
        $this->actingAs($owner)
            ->post('/pengeluaran', $this->payload($category, [
                'receipt' => UploadedFile::fake()->create('nota.pdf', 100, 'application/pdf'),
            ]))
            ->assertRedirect();

        $pdfExpense = Expense::query()->latest('id')->firstOrFail();
        $this->assertTrue($pdfExpense->receiptIsPdf());
    }

    public function test_new_receipt_replaces_and_deletes_old_file(): void
    {
        Storage::fake('public');

        $owner = User::factory()->owner()->create();
        $category = ExpenseCategory::factory()->create();

        $this->actingAs($owner)->post('/pengeluaran', $this->payload($category, [
            'receipt' => UploadedFile::fake()->image('lama.jpg'),
        ]));

        $expense = Expense::firstOrFail();
        $oldPath = $expense->receipt_path;

        $this->actingAs($owner)
            ->put("/pengeluaran/{$expense->id}", $this->payload($category, [
                'receipt' => UploadedFile::fake()->image('baru.png'),
            ]))
            ->assertRedirect()
            ->assertSessionHas('success');

        $newPath = $expense->fresh()->receipt_path;

        $this->assertNotSame($oldPath, $newPath);
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($newPath);
    }

    public function test_invalid_receipt_type_and_oversize_are_rejected(): void
    {
        Storage::fake('public');

        $owner = User::factory()->owner()->create();
        $category = ExpenseCategory::factory()->create();

        // Tipe file tidak diizinkan
        $this->actingAs($owner)
            ->post('/pengeluaran', $this->payload($category, [
                'receipt' => UploadedFile::fake()->create('program.exe', 10),
            ]))
            ->assertSessionHasErrors('receipt');

        // Lebih dari 5 MB
        $this->actingAs($owner)
            ->post('/pengeluaran', $this->payload($category, [
                'receipt' => UploadedFile::fake()->create('besar.pdf', 6000, 'application/pdf'),
            ]))
            ->assertSessionHasErrors('receipt');

        $this->assertSame(0, Expense::count());
    }

    public function test_expenses_are_searchable_by_number_and_title(): void
    {
        $owner = User::factory()->owner()->create();

        $target = Expense::factory()->create([
            'expense_number' => 'EXP-TEST-CARIINI',
            'title' => 'Servis mesin kopi',
        ]);
        Expense::factory()->create([
            'expense_number' => 'EXP-TEST-LAINNYA',
            'title' => 'Beli galon air',
        ]);

        foreach (['CARIINI', 'mesin kopi'] as $keyword) {
            $this->actingAs($owner)
                ->get('/pengeluaran?search='.urlencode($keyword))
                ->assertInertia(fn (Assert $page) => $page
                    ->has('expenses.data', 1)
                    ->where('expenses.data.0.expense_number', $target->expense_number));
        }
    }

    public function test_expenses_are_filterable_by_category_method_and_date(): void
    {
        $owner = User::factory()->owner()->create();
        $categoryA = ExpenseCategory::factory()->create();
        $categoryB = ExpenseCategory::factory()->create();

        $old = Expense::factory()->create([
            'expense_category_id' => $categoryA->id,
            'payment_method' => 'qris',
            'expense_date' => now()->subDays(10)->toDateString(),
        ]);
        $recent = Expense::factory()->create([
            'expense_category_id' => $categoryB->id,
            'payment_method' => 'tunai',
        ]);

        $this->actingAs($owner)
            ->get("/pengeluaran?category={$categoryA->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->has('expenses.data', 1)
                ->where('expenses.data.0.id', $old->id));

        $this->actingAs($owner)
            ->get('/pengeluaran?payment_method=qris')
            ->assertInertia(fn (Assert $page) => $page
                ->has('expenses.data', 1)
                ->where('expenses.data.0.id', $old->id));

        $from = now()->subDays(2)->toDateString();

        $this->actingAs($owner)
            ->get("/pengeluaran?date_from={$from}")
            ->assertInertia(fn (Assert $page) => $page
                ->has('expenses.data', 1)
                ->where('expenses.data.0.id', $recent->id));
    }

    public function test_expense_list_is_paginated(): void
    {
        $owner = User::factory()->owner()->create();
        Expense::factory()->count(12)->create();

        $this->actingAs($owner)
            ->get('/pengeluaran')
            ->assertInertia(fn (Assert $page) => $page
                ->has('expenses.data', 10)
                ->where('expenses.total', 12));
    }

    public function test_stats_count_expenses_and_exclude_deleted(): void
    {
        $owner = User::factory()->owner()->create();

        Expense::factory()->create(['amount' => 50000]);
        Expense::factory()->create([
            'amount' => 30000,
            'expense_date' => now()->subMonths(2)->toDateString(),
        ]);
        Expense::factory()->create(['amount' => 99000])->delete();

        $this->actingAs($owner)
            ->get('/pengeluaran')
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.total', 2)
                ->where('stats.hari_ini', 1)
                ->where('stats.bulan_ini', 1)
                ->where('stats.total_nominal', 80000));
    }

    public function test_trash_list_is_owner_only(): void
    {
        $owner = User::factory()->owner()->create();
        $admin = User::factory()->admin()->create();

        $active = Expense::factory()->create();
        $trashed = Expense::factory()->create();
        $trashed->delete();

        // Owner melihat daftar terhapus lewat trashed=1
        $this->actingAs($owner)
            ->get('/pengeluaran?trashed=1')
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.trashed', true)
                ->has('expenses.data', 1)
                ->where('expenses.data.0.id', $trashed->id));

        // Admin: parameter diabaikan, tetap daftar aktif
        $this->actingAs($admin)
            ->get('/pengeluaran?trashed=1')
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.trashed', false)
                ->has('expenses.data', 1)
                ->where('expenses.data.0.id', $active->id));
    }

    public function test_expense_row_contains_detail_information(): void
    {
        $owner = User::factory()->owner()->create();
        $category = ExpenseCategory::factory()->create(['name' => 'Gas']);

        $this->actingAs($owner)->post('/pengeluaran', $this->payload($category, [
            'notes' => 'Tabung 3kg',
        ]));

        $this->actingAs($owner)
            ->get('/pengeluaran')
            ->assertInertia(fn (Assert $page) => $page
                ->where('expenses.data.0.category', 'Gas')
                ->where('expenses.data.0.title', 'Beli gas 3kg')
                ->where('expenses.data.0.amount', 25000)
                ->where('expenses.data.0.payment_method', 'tunai')
                ->where('expenses.data.0.notes', 'Tabung 3kg')
                ->where('expenses.data.0.user', $owner->name)
                ->where('expenses.data.0.receipt_url', null));
    }
}
