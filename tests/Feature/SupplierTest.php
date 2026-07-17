<?php

namespace Tests\Feature;

use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SupplierTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, mixed> */
    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'CV Kopi Nusantara',
            'contact_person' => 'Budi',
            'phone' => '081234567890',
            'email' => 'kopi@nusantara.test',
            'address' => 'Jl. Kopi No. 1',
            'notes' => null,
            'status' => 'aktif',
        ], $overrides);
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/supplier')->assertRedirect('/login');
    }

    public function test_supplier_page_renders_for_all_roles(): void
    {
        foreach (['owner', 'admin', 'kasir'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)
                ->get('/supplier')
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Supplier/Index')
                    ->has('suppliers')
                    ->has('stats')
                    ->has('can'));
        }
    }

    public function test_supplier_code_is_generated_sequentially(): void
    {
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)
            ->post('/supplier', $this->validPayload(['name' => 'Supplier Satu']))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->actingAs($owner)
            ->post('/supplier', $this->validPayload(['name' => 'Supplier Dua']));

        $this->assertDatabaseHas('suppliers', ['name' => 'Supplier Satu', 'code' => 'SUP-0001']);
        $this->assertDatabaseHas('suppliers', ['name' => 'Supplier Dua', 'code' => 'SUP-0002']);
    }

    public function test_deleted_supplier_code_is_never_reused(): void
    {
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)->post('/supplier', $this->validPayload(['name' => 'Pertama']));
        $first = Supplier::where('name', 'Pertama')->firstOrFail();

        $this->actingAs($owner)->delete("/supplier/{$first->id}");

        $this->actingAs($owner)->post('/supplier', $this->validPayload(['name' => 'Kedua']));

        // Kode SUP-0001 milik supplier terhapus tidak dipakai ulang
        $this->assertDatabaseHas('suppliers', ['name' => 'Kedua', 'code' => 'SUP-0002']);
    }

    public function test_name_is_required_and_email_must_be_valid(): void
    {
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)
            ->post('/supplier', $this->validPayload(['name' => '']))
            ->assertSessionHasErrors('name');

        $this->actingAs($owner)
            ->post('/supplier', $this->validPayload(['email' => 'bukan-email']))
            ->assertSessionHasErrors('email');

        // Telepon & email opsional — boleh kosong
        $this->actingAs($owner)
            ->post('/supplier', $this->validPayload(['phone' => null, 'email' => null]))
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame(1, Supplier::count());
    }

    public function test_admin_can_create_and_update_supplier(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->post('/supplier', $this->validPayload())
            ->assertRedirect()
            ->assertSessionHas('success');

        $supplier = Supplier::firstOrFail();

        $this->actingAs($admin)
            ->put("/supplier/{$supplier->id}", $this->validPayload([
                'name' => 'Nama Baru',
                'status' => 'nonaktif',
            ]))
            ->assertRedirect();

        $supplier->refresh();
        $this->assertSame('Nama Baru', $supplier->name);
        $this->assertSame('nonaktif', $supplier->status);
    }

    public function test_supplier_code_cannot_be_changed_on_update(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create(['code' => 'SUP-0001']);

        $this->actingAs($owner)
            ->put("/supplier/{$supplier->id}", $this->validPayload([
                'code' => 'SUP-9999', // harus diabaikan
            ]))
            ->assertRedirect();

        $this->assertSame('SUP-0001', $supplier->fresh()->code);
    }

    public function test_kasir_cannot_create_update_or_delete(): void
    {
        $kasir = User::factory()->create();
        $supplier = Supplier::factory()->create();

        $this->actingAs($kasir)
            ->post('/supplier', $this->validPayload())
            ->assertForbidden();

        $this->actingAs($kasir)
            ->put("/supplier/{$supplier->id}", $this->validPayload())
            ->assertForbidden();

        $this->actingAs($kasir)
            ->delete("/supplier/{$supplier->id}")
            ->assertForbidden();

        $this->assertSame(1, Supplier::count());
    }

    public function test_owner_can_soft_delete_supplier(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create();

        $this->actingAs($owner)
            ->delete("/supplier/{$supplier->id}")
            ->assertRedirect()
            ->assertSessionHas('success');

        // Soft delete — baris masih ada, tidak hard delete
        $this->assertSoftDeleted('suppliers', ['id' => $supplier->id]);
    }

    public function test_admin_cannot_delete_or_restore_supplier(): void
    {
        $admin = User::factory()->admin()->create();
        $supplier = Supplier::factory()->create();

        $this->actingAs($admin)
            ->delete("/supplier/{$supplier->id}")
            ->assertForbidden();

        $supplier->delete();

        $this->actingAs($admin)
            ->post("/supplier/{$supplier->id}/restore")
            ->assertForbidden();

        $this->assertSoftDeleted('suppliers', ['id' => $supplier->id]);
    }

    public function test_owner_can_restore_deleted_supplier(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create();
        $supplier->delete();

        $this->actingAs($owner)
            ->post("/supplier/{$supplier->id}/restore")
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertNull($supplier->fresh()->deleted_at);
    }

    public function test_suppliers_are_searchable_by_code_name_contact_and_phone(): void
    {
        Supplier::factory()->create([
            'code' => 'SUP-0001',
            'name' => 'CV Kopi Nusantara',
            'contact_person' => 'Budi Santoso',
            'phone' => '0811111111',
        ]);
        Supplier::factory()->create([
            'code' => 'SUP-0002',
            'name' => 'PT Susu Segar',
            'contact_person' => 'Siti Aminah',
            'phone' => '0822222222',
        ]);

        $owner = User::factory()->owner()->create();

        foreach (['SUP-0001', 'Kopi Nusantara', 'Budi', '0811111111'] as $keyword) {
            $this->actingAs($owner)
                ->get('/supplier?search='.urlencode($keyword))
                ->assertInertia(fn (Assert $page) => $page
                    ->has('suppliers.data', 1)
                    ->where('suppliers.data.0.code', 'SUP-0001'));
        }
    }

    public function test_suppliers_are_filterable_by_status_and_sorted_by_name(): void
    {
        Supplier::factory()->create(['name' => 'Zebra Supply', 'status' => 'aktif']);
        Supplier::factory()->nonaktif()->create(['name' => 'Alpha Supply']);

        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)
            ->get('/supplier?status=nonaktif')
            ->assertInertia(fn (Assert $page) => $page
                ->has('suppliers.data', 1)
                ->where('suppliers.data.0.name', 'Alpha Supply'));

        // Urut nama: Alpha sebelum Zebra
        $this->actingAs($owner)
            ->get('/supplier')
            ->assertInertia(fn (Assert $page) => $page
                ->has('suppliers.data', 2)
                ->where('suppliers.data.0.name', 'Alpha Supply')
                ->where('suppliers.data.1.name', 'Zebra Supply'));
    }

    public function test_supplier_list_is_paginated(): void
    {
        Supplier::factory()->count(15)->create();

        $this->actingAs(User::factory()->owner()->create())
            ->get('/supplier')
            ->assertInertia(fn (Assert $page) => $page
                ->has('suppliers.data', 10)
                ->where('suppliers.total', 15));
    }

    public function test_stats_count_suppliers_correctly(): void
    {
        Supplier::factory()->count(2)->create();
        Supplier::factory()->nonaktif()->create();
        Supplier::factory()->create()->delete();

        $this->actingAs(User::factory()->owner()->create())
            ->get('/supplier')
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.total', 3)
                ->where('stats.aktif', 2)
                ->where('stats.nonaktif', 1)
                ->where('stats.terhapus', 1));
    }

    public function test_only_owner_can_view_trashed_suppliers(): void
    {
        $active = Supplier::factory()->create(['name' => 'Masih Aktif']);
        $deleted = Supplier::factory()->create(['name' => 'Sudah Dihapus']);
        $deleted->delete();

        // Owner: daftar terhapus berisi supplier yang dihapus saja
        $this->actingAs(User::factory()->owner()->create())
            ->get('/supplier?trashed=1')
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.trashed', true)
                ->has('suppliers.data', 1)
                ->where('suppliers.data.0.name', 'Sudah Dihapus'));

        // Admin: parameter trashed diabaikan — tetap daftar aktif
        $this->actingAs(User::factory()->admin()->create())
            ->get('/supplier?trashed=1')
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.trashed', false)
                ->has('suppliers.data', 1)
                ->where('suppliers.data.0.name', 'Masih Aktif'));
    }

    public function test_status_nonaktif_keeps_supplier_history_intact(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create();

        $this->actingAs($owner)
            ->put("/supplier/{$supplier->id}", $this->validPayload(['status' => 'nonaktif']))
            ->assertRedirect();

        // Nonaktif ≠ terhapus: tetap ada di daftar & database
        $this->assertNull($supplier->fresh()->deleted_at);
        $this->assertSame('nonaktif', $supplier->fresh()->status);
    }
}
