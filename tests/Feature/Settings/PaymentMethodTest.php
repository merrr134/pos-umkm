<?php

namespace Tests\Feature\Settings;

use App\Models\PaymentMethod;
use App\Models\User;
use Database\Seeders\PaymentMethodSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentMethodTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PaymentMethodSeeder::class);
    }

    public function test_owner_can_deactivate_a_payment_method(): void
    {
        $owner = User::factory()->owner()->create();
        $qris = PaymentMethod::where('code', 'qris')->first();

        $response = $this->actingAs($owner)->put(
            "/pengaturan/metode-pembayaran/{$qris->id}",
            ['is_active' => false],
        );

        $response->assertRedirect()->assertSessionHas('success');
        $this->assertFalse($qris->fresh()->is_active);
    }

    public function test_admin_can_activate_a_payment_method(): void
    {
        $admin = User::factory()->admin()->create();
        $kartu = PaymentMethod::where('code', 'kartu')->first();

        $response = $this->actingAs($admin)->put(
            "/pengaturan/metode-pembayaran/{$kartu->id}",
            ['is_active' => true],
        );

        $response->assertRedirect()->assertSessionHasNoErrors();
        $this->assertTrue($kartu->fresh()->is_active);
    }

    public function test_kasir_cannot_toggle_payment_methods(): void
    {
        $kasir = User::factory()->create();
        $qris = PaymentMethod::where('code', 'qris')->first();

        $this->actingAs($kasir)->put(
            "/pengaturan/metode-pembayaran/{$qris->id}",
            ['is_active' => false],
        )->assertForbidden();
    }

    public function test_last_active_payment_method_cannot_be_deactivated(): void
    {
        $owner = User::factory()->owner()->create();

        // Sisakan hanya Tunai yang aktif
        PaymentMethod::where('code', '!=', 'tunai')->update(['is_active' => false]);
        $tunai = PaymentMethod::where('code', 'tunai')->first();

        $response = $this->actingAs($owner)->put(
            "/pengaturan/metode-pembayaran/{$tunai->id}",
            ['is_active' => false],
        );

        $response->assertSessionHasErrors('is_active');
        $this->assertTrue($tunai->fresh()->is_active);
        $this->assertSame(1, PaymentMethod::where('is_active', true)->count());
    }

    public function test_deactivating_when_others_are_active_is_allowed(): void
    {
        $owner = User::factory()->owner()->create();
        $tunai = PaymentMethod::where('code', 'tunai')->first();

        $response = $this->actingAs($owner)->put(
            "/pengaturan/metode-pembayaran/{$tunai->id}",
            ['is_active' => false],
        );

        $response->assertSessionHasNoErrors();
        $this->assertFalse($tunai->fresh()->is_active);
        $this->assertTrue(PaymentMethod::where('is_active', true)->exists());
    }
}
