<?php

namespace Tests\Feature\Settings;

use App\Models\Setting;
use App\Models\User;
use Database\Seeders\SettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StoreProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(SettingSeeder::class);
    }

    public function test_owner_can_view_pengaturan_page(): void
    {
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)->get('/pengaturan')->assertOk();
    }

    public function test_admin_can_view_pengaturan_page(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->get('/pengaturan')->assertOk();
    }

    public function test_kasir_cannot_view_pengaturan_page(): void
    {
        $kasir = User::factory()->create();

        $this->actingAs($kasir)->get('/pengaturan')->assertForbidden();
    }

    public function test_owner_can_update_store_profile(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/pengaturan/profil', [
            'store_name' => 'Pitou Cafe Baru',
            'store_address' => 'Jl. Kopi No. 1',
            'store_phone' => '081234567890',
            'store_email' => 'halo@pitoucafe.com',
            'store_instagram' => '@pitoucafe',
            'receipt_footer' => 'Terima kasih, sampai jumpa lagi!',
        ]);

        $response->assertRedirect()->assertSessionHas('success');

        $this->assertSame('Pitou Cafe Baru', Setting::getValue('store_name'));
        $this->assertSame('Jl. Kopi No. 1', Setting::getValue('store_address'));
        $this->assertSame('081234567890', Setting::getValue('store_phone'));
        $this->assertSame('halo@pitoucafe.com', Setting::getValue('store_email'));
        $this->assertSame('@pitoucafe', Setting::getValue('store_instagram'));
        $this->assertSame('Terima kasih, sampai jumpa lagi!', Setting::getValue('receipt_footer'));
    }

    public function test_store_name_is_required(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/pengaturan/profil', [
            'store_name' => '',
        ]);

        $response->assertSessionHasErrors('store_name');
        $this->assertSame('Pitou Cafe', Setting::getValue('store_name'));
    }

    public function test_invalid_email_is_rejected(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/pengaturan/profil', [
            'store_name' => 'Pitou Cafe',
            'store_email' => 'bukan-email',
        ]);

        $response->assertSessionHasErrors('store_email');
    }

    public function test_admin_cannot_update_store_profile(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->post('/pengaturan/profil', [
            'store_name' => 'Cafe Admin',
        ])->assertForbidden();
    }

    public function test_owner_can_upload_logo(): void
    {
        Storage::fake('public');
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/pengaturan/profil', [
            'store_name' => 'Pitou Cafe',
            'logo' => UploadedFile::fake()->image('logo.png', 200, 200),
        ]);

        $response->assertRedirect()->assertSessionHasNoErrors();

        $path = Setting::getValue('store_logo');
        $this->assertNotNull($path);
        Storage::disk('public')->assertExists($path);
    }

    public function test_new_logo_replaces_old_logo_file(): void
    {
        Storage::fake('public');
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)->post('/pengaturan/profil', [
            'store_name' => 'Pitou Cafe',
            'logo' => UploadedFile::fake()->image('logo-lama.png'),
        ]);
        $oldPath = Setting::getValue('store_logo');

        $this->actingAs($owner)->post('/pengaturan/profil', [
            'store_name' => 'Pitou Cafe',
            'logo' => UploadedFile::fake()->image('logo-baru.webp'),
        ]);
        $newPath = Setting::getValue('store_logo');

        $this->assertNotSame($oldPath, $newPath);
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($newPath);
    }

    public function test_logo_larger_than_2mb_is_rejected(): void
    {
        Storage::fake('public');
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/pengaturan/profil', [
            'store_name' => 'Pitou Cafe',
            'logo' => UploadedFile::fake()->image('logo.png')->size(2049),
        ]);

        $response->assertSessionHasErrors('logo');
    }

    public function test_logo_with_invalid_format_is_rejected(): void
    {
        Storage::fake('public');
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->post('/pengaturan/profil', [
            'store_name' => 'Pitou Cafe',
            'logo' => UploadedFile::fake()->create('logo.pdf', 100, 'application/pdf'),
        ]);

        $response->assertSessionHasErrors('logo');
    }

    public function test_store_profile_is_shared_on_login_page(): void
    {
        Setting::setValue('store_name', 'Cafe Keren');

        $response = $this->get('/login');

        $response->assertOk()->assertInertia(
            fn ($page) => $page->where('store.name', 'Cafe Keren'),
        );
    }
}
