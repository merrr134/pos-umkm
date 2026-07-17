<?php

namespace Tests\Feature\Settings;

use App\Models\Setting;
use App\Models\User;
use Database\Seeders\SettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fase 16 — Pengaturan WhatsApp (PRD 5.5). Toggle kirim struk digital;
 * default OFF; Owner & Admin boleh, Kasir dilarang.
 */
class WhatsappSettingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(SettingSeeder::class);
    }

    public function test_whatsapp_is_off_by_default(): void
    {
        $this->assertSame('0', Setting::getValue('whatsapp_enabled'));
    }

    public function test_owner_can_enable_whatsapp(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->put('/pengaturan/whatsapp', [
            'whatsapp_enabled' => true,
        ]);

        $response->assertRedirect()->assertSessionHas('success');
        $this->assertSame('1', Setting::getValue('whatsapp_enabled'));
    }

    public function test_admin_can_toggle_whatsapp(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->put('/pengaturan/whatsapp', [
            'whatsapp_enabled' => true,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame('1', Setting::getValue('whatsapp_enabled'));

        $this->actingAs($admin)->put('/pengaturan/whatsapp', [
            'whatsapp_enabled' => false,
        ]);

        $this->assertSame('0', Setting::getValue('whatsapp_enabled'));
    }

    public function test_kasir_cannot_update_whatsapp(): void
    {
        $kasir = User::factory()->create();

        $this->actingAs($kasir)->put('/pengaturan/whatsapp', [
            'whatsapp_enabled' => true,
        ])->assertForbidden();

        $this->assertSame('0', Setting::getValue('whatsapp_enabled'));
    }

    public function test_whatsapp_enabled_is_required(): void
    {
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)->put('/pengaturan/whatsapp', [])
            ->assertSessionHasErrors('whatsapp_enabled');
    }

    public function test_whatsapp_flag_is_shared_to_inertia(): void
    {
        Setting::setValue('whatsapp_enabled', '1');
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)->get('/kasir')
            ->assertInertia(fn ($page) => $page->where('whatsapp.enabled', true));
    }
}
