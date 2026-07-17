<?php

namespace Tests\Feature\Settings;

use App\Models\Setting;
use App\Models\User;
use Database\Seeders\SettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaxSettingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(SettingSeeder::class);
    }

    public function test_owner_can_update_tax_settings(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->put('/pengaturan/pajak', [
            'tax_enabled' => true,
            'tax_name' => 'PPN',
            'tax_percent' => 11,
            'rounding_method' => 'up_100',
        ]);

        $response->assertRedirect()->assertSessionHas('success');

        $this->assertSame('1', Setting::getValue('tax_enabled'));
        $this->assertSame('PPN', Setting::getValue('tax_name'));
        $this->assertSame('11', Setting::getValue('tax_percent'));
        $this->assertSame('up_100', Setting::getValue('rounding_method'));
    }

    public function test_admin_can_update_tax_settings(): void
    {
        $admin = User::factory()->admin()->create();

        $response = $this->actingAs($admin)->put('/pengaturan/pajak', [
            'tax_enabled' => false,
            'tax_name' => 'Pajak',
            'tax_percent' => 0,
            'rounding_method' => 'none',
        ]);

        $response->assertRedirect()->assertSessionHasNoErrors();
        $this->assertSame('0', Setting::getValue('tax_enabled'));
    }

    public function test_kasir_cannot_update_tax_settings(): void
    {
        $kasir = User::factory()->create();

        $this->actingAs($kasir)->put('/pengaturan/pajak', [
            'tax_enabled' => true,
            'tax_name' => 'PPN',
            'tax_percent' => 11,
            'rounding_method' => 'none',
        ])->assertForbidden();
    }

    public function test_tax_percent_above_100_is_rejected(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->put('/pengaturan/pajak', [
            'tax_enabled' => true,
            'tax_name' => 'PPN',
            'tax_percent' => 101,
            'rounding_method' => 'none',
        ]);

        $response->assertSessionHasErrors('tax_percent');
    }

    public function test_negative_tax_percent_is_rejected(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->put('/pengaturan/pajak', [
            'tax_enabled' => true,
            'tax_name' => 'PPN',
            'tax_percent' => -1,
            'rounding_method' => 'none',
        ]);

        $response->assertSessionHasErrors('tax_percent');
    }

    public function test_tax_name_is_required_when_tax_enabled(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->put('/pengaturan/pajak', [
            'tax_enabled' => true,
            'tax_name' => '',
            'tax_percent' => 10,
            'rounding_method' => 'none',
        ]);

        $response->assertSessionHasErrors('tax_name');
    }

    public function test_invalid_rounding_method_is_rejected(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->put('/pengaturan/pajak', [
            'tax_enabled' => false,
            'tax_name' => 'Pajak',
            'tax_percent' => 0,
            'rounding_method' => 'sembarang',
        ]);

        $response->assertSessionHasErrors('rounding_method');
    }
}
