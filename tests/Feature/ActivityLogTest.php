<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Category;
use App\Models\ExpenseCategory;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use Database\Seeders\PaymentMethodSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use LogicException;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    /** @param array<string, mixed> $overrides */
    private function makeLog(User $user, array $overrides = []): ActivityLog
    {
        return ActivityLog::create(array_merge([
            'user_id' => $user->id,
            'role' => $user->role,
            'module' => 'Produk',
            'activity' => 'Tambah Produk',
            'description' => null,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
        ], $overrides));
    }

    public function test_activity_log_page_is_owner_only(): void
    {
        $this->get('/activity-log')->assertRedirect('/login');

        $this->actingAs(User::factory()->admin()->create())
            ->get('/activity-log')
            ->assertForbidden();

        $this->actingAs(User::factory()->create()) // kasir
            ->get('/activity-log')
            ->assertForbidden();

        $this->actingAs(User::factory()->owner()->create())
            ->get('/activity-log')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('ActivityLog/Index')
                ->has('logs')
                ->has('modules')
                ->has('roles'));
    }

    public function test_login_and_logout_are_logged(): void
    {
        $user = User::factory()->create(['username' => 'kasir_rajin']);

        $this->post('/login', [
            'username' => 'kasir_rajin',
            'password' => 'password',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $user->id,
            'role' => 'kasir',
            'module' => 'Auth',
            'activity' => 'Login',
        ]);

        $this->post('/logout');

        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $user->id,
            'module' => 'Auth',
            'activity' => 'Logout',
        ]);

        // IP & user agent ikut tercatat
        $log = ActivityLog::query()->where('activity', 'Login')->firstOrFail();
        $this->assertNotNull($log->ip_address);
        $this->assertNotNull($log->user_agent);
    }

    public function test_crud_actions_are_logged_through_service(): void
    {
        $this->seed(PaymentMethodSeeder::class);

        $owner = User::factory()->owner()->create();
        $category = Category::factory()->create();

        // Produk: tambah → edit → hapus
        $this->actingAs($owner)->post('/produk', [
            'name' => 'Kopi Susu',
            'category_id' => $category->id,
            'price' => 15000,
            'status' => 'aktif',
            'track_stock' => false,
        ]);
        $product = Product::firstOrFail();

        $this->actingAs($owner)->put("/produk/{$product->id}", [
            'name' => 'Kopi Susu Gula Aren',
            'category_id' => $category->id,
            'price' => 18000,
            'status' => 'aktif',
            'track_stock' => false,
        ]);

        $this->actingAs($owner)->delete("/produk/{$product->id}");

        foreach (['Tambah Produk', 'Edit Produk', 'Hapus Produk'] as $activity) {
            $this->assertDatabaseHas('activity_logs', [
                'module' => 'Produk',
                'activity' => $activity,
            ]);
        }

        // User: tambah + reset password
        $this->actingAs($owner)->post('/users', [
            'name' => 'Kasir Baru',
            'username' => 'kasir_baru',
            'password' => 'rahasia-123',
            'password_confirmation' => 'rahasia-123',
            'role' => 'kasir',
            'is_active' => true,
        ]);
        $newUser = User::query()->where('username', 'kasir_baru')->firstOrFail();

        $this->actingAs($owner)->post("/users/{$newUser->id}/reset-password");

        $this->assertDatabaseHas('activity_logs', ['activity' => 'Tambah User']);
        $this->assertDatabaseHas('activity_logs', ['activity' => 'Reset Password']);

        // Supplier + Pengeluaran
        $this->actingAs($owner)->post('/supplier', [
            'name' => 'CV Kopi Nusantara',
            'contact_person' => '',
            'phone' => '',
            'email' => '',
            'address' => '',
            'notes' => '',
            'status' => Supplier::STATUS_AKTIF,
        ]);

        $expenseCategory = ExpenseCategory::factory()->create();
        $this->actingAs($owner)->post('/pengeluaran', [
            'expense_date' => now()->toDateString(),
            'expense_category_id' => $expenseCategory->id,
            'title' => 'Beli gas',
            'amount' => 25000,
            'payment_method' => 'tunai',
            'notes' => null,
        ]);

        $this->assertDatabaseHas('activity_logs', ['activity' => 'Tambah Supplier']);
        $this->assertDatabaseHas('activity_logs', ['activity' => 'Tambah Pengeluaran']);
    }

    public function test_logs_are_searchable_and_filterable(): void
    {
        $owner = User::factory()->owner()->create(['name' => 'Pemilik Cafe']);
        $admin = User::factory()->admin()->create(['name' => 'Ani Admin']);

        $this->makeLog($owner, [
            'module' => 'Backup',
            'activity' => 'Backup Database',
            'description' => 'Membuat backup malam',
        ]);
        $this->makeLog($admin, ['activity' => 'Edit Produk']);
        $old = $this->makeLog($owner, ['activity' => 'Hapus Produk']);
        $old->timestamps = false;
        ActivityLog::query()->whereKey($old->id)
            ->update(['created_at' => now()->subDays(10)]);

        // Search aktivitas / deskripsi / nama user
        $this->actingAs($owner)
            ->get('/activity-log?search='.urlencode('backup malam'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('logs.data', 1)
                ->where('logs.data.0.activity', 'Backup Database'));

        $this->actingAs($owner)
            ->get('/activity-log?search='.urlencode('Ani'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('logs.data', 1)
                ->where('logs.data.0.user', 'Ani Admin'));

        // Filter role
        $this->actingAs($owner)
            ->get('/activity-log?role=admin')
            ->assertInertia(fn (Assert $page) => $page
                ->has('logs.data', 1)
                ->where('logs.data.0.role', 'admin'));

        // Filter modul
        $this->actingAs($owner)
            ->get('/activity-log?module=Backup')
            ->assertInertia(fn (Assert $page) => $page
                ->has('logs.data', 1)
                ->where('logs.data.0.module', 'Backup'));

        // Filter rentang tanggal
        $from = now()->subDays(2)->toDateString();

        $this->actingAs($owner)
            ->get("/activity-log?date_from={$from}")
            ->assertInertia(fn (Assert $page) => $page
                ->has('logs.data', 2));
    }

    public function test_log_list_is_paginated(): void
    {
        $owner = User::factory()->owner()->create();

        for ($i = 0; $i < 12; $i++) {
            $this->makeLog($owner);
        }

        $this->actingAs($owner)
            ->get('/activity-log')
            ->assertInertia(fn (Assert $page) => $page
                ->has('logs.data', 10)
                ->where('logs.total', 12));
    }

    public function test_activity_log_is_append_only(): void
    {
        $owner = User::factory()->owner()->create();
        $log = $this->makeLog($owner);

        // Model menolak update & delete (append-only)
        try {
            $log->update(['activity' => 'Diubah']);
            $this->fail('Update pada activity log seharusnya ditolak.');
        } catch (LogicException) {
            $this->assertDatabaseHas('activity_logs', ['activity' => 'Tambah Produk']);
        }

        try {
            $log->delete();
            $this->fail('Delete pada activity log seharusnya ditolak.');
        } catch (LogicException) {
            $this->assertDatabaseHas('activity_logs', ['id' => $log->id]);
        }

        // Tidak ada route pengubah — PUT/DELETE ke /activity-log 404
        $this->actingAs($owner)->put("/activity-log/{$log->id}", [])->assertNotFound();
        $this->actingAs($owner)->delete("/activity-log/{$log->id}")->assertNotFound();
    }
}
