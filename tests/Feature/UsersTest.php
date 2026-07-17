<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UsersTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Budi Barista',
            'username' => 'budi',
            'password' => 'rahasia-123',
            'password_confirmation' => 'rahasia-123',
            'role' => 'kasir',
            'is_active' => true,
        ], $overrides);
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/users')->assertRedirect('/login');
    }

    public function test_page_renders_for_owner_and_admin_but_kasir_forbidden(): void
    {
        $this->actingAs(User::factory()->owner()->create())
            ->get('/users')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Users/Index')
                ->has('users')
                ->has('stats')
                ->where('stats.total_role', 3)
                ->where('can.manage', true));

        $this->actingAs(User::factory()->admin()->create())
            ->get('/users')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('can.manage', false));

        $this->actingAs(User::factory()->create()) // kasir
            ->get('/users')
            ->assertForbidden();
    }

    public function test_owner_can_create_user_with_hashed_password(): void
    {
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)
            ->post('/users', $this->payload())
            ->assertRedirect()
            ->assertSessionHas('success');

        $user = User::query()->where('username', 'budi')->firstOrFail();

        $this->assertSame('Budi Barista', $user->name);
        $this->assertSame('kasir', $user->role);
        $this->assertTrue($user->is_active);
        // Password di-hash, bukan plaintext
        $this->assertNotSame('rahasia-123', $user->password);
        $this->assertTrue(Hash::check('rahasia-123', $user->password));
    }

    public function test_photo_upload_and_replacement_deletes_old_file(): void
    {
        Storage::fake('public');

        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)->post('/users', $this->payload([
            'photo' => UploadedFile::fake()->image('budi.jpg'),
        ]));

        $user = User::query()->where('username', 'budi')->firstOrFail();
        $oldPhoto = $user->photo;

        $this->assertNotNull($oldPhoto);
        Storage::disk('public')->assertExists($oldPhoto);

        // Ganti foto → file lama dihapus
        $this->actingAs($owner)
            ->put("/users/{$user->id}", $this->payload([
                'password' => '',
                'password_confirmation' => '',
                'photo' => UploadedFile::fake()->image('baru.png'),
            ]))
            ->assertRedirect()
            ->assertSessionHas('success');

        $newPhoto = $user->fresh()->photo;

        $this->assertNotSame($oldPhoto, $newPhoto);
        Storage::disk('public')->assertMissing($oldPhoto);
        Storage::disk('public')->assertExists($newPhoto);
    }

    public function test_update_keeps_password_when_blank_and_changes_when_filled(): void
    {
        $owner = User::factory()->owner()->create();
        $user = User::factory()->create(['username' => 'budi']);

        // Password kosong → tidak berubah
        $this->actingAs($owner)
            ->put("/users/{$user->id}", $this->payload([
                'name' => 'Budi Update',
                'password' => '',
                'password_confirmation' => '',
            ]))
            ->assertRedirect();

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
        $this->assertSame('Budi Update', $user->fresh()->name);

        // Password diisi → berubah
        $this->actingAs($owner)
            ->put("/users/{$user->id}", $this->payload([
                'password' => 'password-baru',
                'password_confirmation' => 'password-baru',
            ]))
            ->assertRedirect();

        $this->assertTrue(Hash::check('password-baru', $user->fresh()->password));
    }

    public function test_validation_rejects_duplicate_username_and_weak_password(): void
    {
        $owner = User::factory()->owner()->create();
        User::factory()->create(['username' => 'budi']);

        // Username duplikat
        $this->actingAs($owner)
            ->post('/users', $this->payload())
            ->assertSessionHasErrors('username');

        // Password < 8 karakter
        $this->actingAs($owner)
            ->post('/users', $this->payload([
                'username' => 'lain',
                'password' => 'pendek',
                'password_confirmation' => 'pendek',
            ]))
            ->assertSessionHasErrors('password');

        // Konfirmasi tidak cocok
        $this->actingAs($owner)
            ->post('/users', $this->payload([
                'username' => 'lain',
                'password_confirmation' => 'berbeda-123',
            ]))
            ->assertSessionHasErrors('password');

        // Foto bukan format yang diizinkan
        Storage::fake('public');
        $this->actingAs($owner)
            ->post('/users', $this->payload([
                'username' => 'lain',
                'photo' => UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf'),
            ]))
            ->assertSessionHasErrors('photo');
    }

    public function test_admin_and_kasir_cannot_manage_users(): void
    {
        $admin = User::factory()->admin()->create();
        $kasir = User::factory()->create();
        $target = User::factory()->create();

        foreach ([$admin, $kasir] as $actor) {
            $this->actingAs($actor)->post('/users', $this->payload())->assertForbidden();
            $this->actingAs($actor)->put("/users/{$target->id}", $this->payload())->assertForbidden();
            $this->actingAs($actor)->post("/users/{$target->id}/toggle-status")->assertForbidden();
            $this->actingAs($actor)->post("/users/{$target->id}/reset-password")->assertForbidden();
        }
    }

    public function test_owner_cannot_deactivate_self(): void
    {
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)
            ->post("/users/{$owner->id}/toggle-status")
            ->assertSessionHasErrors('is_active');

        $this->assertTrue($owner->fresh()->is_active);
    }

    public function test_last_active_owner_cannot_be_deactivated_or_demoted(): void
    {
        // Username eksplisit — username acak faker bisa mengandung
        // titik yang ditolak aturan alpha_dash
        $owner = User::factory()->owner()->create(['username' => 'owner_utama']);
        $secondOwner = User::factory()->owner()->create(['username' => 'owner_kedua']);

        // Masih ada 2 owner → owner kedua boleh dinonaktifkan
        $this->actingAs($owner)
            ->post("/users/{$secondOwner->id}/toggle-status")
            ->assertSessionHas('success');

        $this->assertFalse($secondOwner->fresh()->is_active);

        // $owner kini owner aktif terakhir → owner lain tidak bisa
        // menonaktifkan atau mengganti role-nya (guard di server;
        // di sini diuji lewat update role oleh dirinya sendiri)
        $this->actingAs($owner)
            ->put("/users/{$owner->id}", $this->payload([
                'username' => $owner->username,
                'name' => $owner->name,
                'password' => '',
                'password_confirmation' => '',
                'role' => 'admin',
            ]))
            ->assertSessionHasErrors('is_active');

        $this->assertSame('owner', $owner->fresh()->role);
    }

    public function test_owner_can_toggle_user_status(): void
    {
        $owner = User::factory()->owner()->create();
        $user = User::factory()->create();

        $this->actingAs($owner)
            ->post("/users/{$user->id}/toggle-status")
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertFalse($user->fresh()->is_active);

        $this->actingAs($owner)
            ->post("/users/{$user->id}/toggle-status")
            ->assertRedirect();

        $this->assertTrue($user->fresh()->is_active);
    }

    public function test_reset_password_generates_random_hashed_password_shown_once(): void
    {
        $owner = User::factory()->owner()->create();
        $user = User::factory()->create();

        $response = $this->actingAs($owner)
            ->post("/users/{$user->id}/reset-password")
            ->assertRedirect()
            ->assertSessionHas('success')
            ->assertSessionHas('new_password');

        $newPassword = session('new_password');

        $this->assertSame(10, strlen($newPassword));
        // Password lama tidak berlaku, password baru ter-hash & valid
        $fresh = $user->fresh();
        $this->assertFalse(Hash::check('password', $fresh->password));
        $this->assertTrue(Hash::check($newPassword, $fresh->password));
        $this->assertNotSame($newPassword, $fresh->password);
    }

    public function test_inactive_user_cannot_login(): void
    {
        $user = User::factory()->inactive()->create(['username' => 'nonaktif']);

        $this->post('/login', [
            'username' => 'nonaktif',
            'password' => 'password',
        ])->assertSessionHasErrors();

        $this->assertGuest();
    }

    public function test_successful_login_records_last_login(): void
    {
        $user = User::factory()->create(['username' => 'budi']);

        $this->assertNull($user->last_login_at);

        $this->post('/login', [
            'username' => 'budi',
            'password' => 'password',
        ]);

        $this->assertAuthenticatedAs($user);

        $fresh = $user->fresh();
        $this->assertNotNull($fresh->last_login_at);
        $this->assertNotNull($fresh->last_login_ip);
    }

    public function test_users_are_searchable_and_filterable(): void
    {
        $owner = User::factory()->owner()->create(['name' => 'Pemilik']);
        User::factory()->admin()->create(['name' => 'Ani Admin', 'username' => 'ani']);
        User::factory()->inactive()->create(['name' => 'Kasir Libur', 'username' => 'libur']);

        // Search nama / username
        $this->actingAs($owner)
            ->get('/users?search=ani')
            ->assertInertia(fn (Assert $page) => $page
                ->has('users.data', 1)
                ->where('users.data.0.username', 'ani'));

        // Filter role
        $this->actingAs($owner)
            ->get('/users?role=admin')
            ->assertInertia(fn (Assert $page) => $page
                ->has('users.data', 1)
                ->where('users.data.0.role', 'admin'));

        // Filter status
        $this->actingAs($owner)
            ->get('/users?status=nonaktif')
            ->assertInertia(fn (Assert $page) => $page
                ->has('users.data', 1)
                ->where('users.data.0.username', 'libur'));

        // Statistik
        $this->actingAs($owner)
            ->get('/users')
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.total', 3)
                ->where('stats.aktif', 2)
                ->where('stats.nonaktif', 1));
    }

    public function test_user_list_is_paginated_and_never_leaks_password(): void
    {
        $owner = User::factory()->owner()->create();
        User::factory()->count(11)->create();

        $this->actingAs($owner)
            ->get('/users')
            ->assertInertia(fn (Assert $page) => $page
                ->has('users.data', 10)
                ->where('users.total', 12)
                ->missing('users.data.0.password'));
    }
}
