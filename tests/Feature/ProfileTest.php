<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_page_renders_for_all_roles(): void
    {
        foreach (['owner', 'admin', 'kasir'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)
                ->get('/profile')
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Profile/Edit')
                    ->where('profile.name', $user->name)
                    ->where('profile.username', $user->username)
                    ->where('profile.role', $role)
                    // Password/hash tidak pernah dikirim ke frontend
                    ->missing('profile.password'));
        }
    }

    public function test_user_can_update_name_and_username(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->put('/profile', [
                'name' => 'Nama Baru',
                'username' => 'username_baru',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $fresh = $user->fresh();
        $this->assertSame('Nama Baru', $fresh->name);
        $this->assertSame('username_baru', $fresh->username);
    }

    public function test_role_cannot_be_changed_via_profile(): void
    {
        $user = User::factory()->create(['username' => 'kasir_setia']);

        // Field role dikirim → harus diabaikan server
        $this->actingAs($user)
            ->put('/profile', [
                'name' => $user->name,
                'username' => $user->username,
                'role' => 'owner',
                'is_active' => false,
            ])
            ->assertRedirect();

        $fresh = $user->fresh();
        $this->assertSame('kasir', $fresh->role);
        $this->assertTrue($fresh->is_active);
    }

    public function test_username_must_be_unique_against_other_users(): void
    {
        User::factory()->create(['username' => 'terpakai']);
        $user = User::factory()->create(['username' => 'punyaku']);

        $this->actingAs($user)
            ->put('/profile', [
                'name' => $user->name,
                'username' => 'terpakai',
            ])
            ->assertSessionHasErrors('username');

        // Username sendiri tetap boleh (ignore self)
        $this->actingAs($user)
            ->put('/profile', [
                'name' => $user->name,
                'username' => 'punyaku',
            ])
            ->assertSessionDoesntHaveErrors();
    }

    public function test_profile_photo_upload_and_replacement_deletes_old_file(): void
    {
        Storage::fake('public');

        // Username eksplisit — username acak faker bisa mengandung
        // titik yang ditolak aturan alpha_dash
        $user = User::factory()->create(['username' => 'pemilik_foto']);

        $this->actingAs($user)->put('/profile', [
            'name' => $user->name,
            'username' => $user->username,
            'photo' => UploadedFile::fake()->image('saya.jpg'),
        ])->assertRedirect();

        $oldPhoto = $user->fresh()->photo;
        $this->assertNotNull($oldPhoto);
        Storage::disk('public')->assertExists($oldPhoto);

        $this->actingAs($user)->put('/profile', [
            'name' => $user->name,
            'username' => $user->username,
            'photo' => UploadedFile::fake()->image('baru.webp'),
        ])->assertRedirect();

        $newPhoto = $user->fresh()->photo;
        $this->assertNotSame($oldPhoto, $newPhoto);
        Storage::disk('public')->assertMissing($oldPhoto);
        Storage::disk('public')->assertExists($newPhoto);
    }

    public function test_password_update_requires_correct_current_password(): void
    {
        $user = User::factory()->create(); // password: "password"

        // Password saat ini salah → ditolak
        $this->actingAs($user)
            ->put('/profile/password', [
                'current_password' => 'salah-total',
                'password' => 'password-baru',
                'password_confirmation' => 'password-baru',
            ])
            ->assertSessionHasErrors('current_password');

        $this->assertTrue(Hash::check('password', $user->fresh()->password));

        // Password baru < 8 karakter → ditolak
        $this->actingAs($user)
            ->put('/profile/password', [
                'current_password' => 'password',
                'password' => 'pendek',
                'password_confirmation' => 'pendek',
            ])
            ->assertSessionHasErrors('password');

        // Valid → password berganti (ter-hash)
        $this->actingAs($user)
            ->put('/profile/password', [
                'current_password' => 'password',
                'password' => 'password-baru',
                'password_confirmation' => 'password-baru',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $fresh = $user->fresh();
        $this->assertTrue(Hash::check('password-baru', $fresh->password));
        $this->assertNotSame('password-baru', $fresh->password);
    }
}
