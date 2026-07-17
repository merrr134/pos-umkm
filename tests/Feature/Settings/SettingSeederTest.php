<?php

namespace Tests\Feature\Settings;

use App\Models\PaymentMethod;
use App\Models\Setting;
use Database\Seeders\PaymentMethodSeeder;
use Database\Seeders\SettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_setting_seeder_creates_defaults(): void
    {
        $this->seed(SettingSeeder::class);

        $this->assertSame('Pitou Cafe', Setting::getValue('store_name'));
        $this->assertSame('0', Setting::getValue('tax_enabled'));
        $this->assertSame('Pajak', Setting::getValue('tax_name'));
        $this->assertSame('0', Setting::getValue('tax_percent'));
        $this->assertSame('none', Setting::getValue('rounding_method'));
    }

    public function test_setting_seeder_does_not_overwrite_existing_values(): void
    {
        Setting::setValue('store_name', 'Cafe Custom');

        $this->seed(SettingSeeder::class);

        $this->assertSame('Cafe Custom', Setting::getValue('store_name'));
    }

    public function test_payment_method_seeder_creates_defaults(): void
    {
        $this->seed(PaymentMethodSeeder::class);

        $this->assertSame(4, PaymentMethod::count());

        $this->assertTrue(PaymentMethod::where('code', 'tunai')->first()->is_active);
        $this->assertTrue(PaymentMethod::where('code', 'qris')->first()->is_active);
        $this->assertTrue(PaymentMethod::where('code', 'transfer')->first()->is_active);
        $this->assertFalse(PaymentMethod::where('code', 'kartu')->first()->is_active);
    }

    public function test_payment_method_seeder_is_idempotent(): void
    {
        $this->seed(PaymentMethodSeeder::class);
        $this->seed(PaymentMethodSeeder::class);

        $this->assertSame(4, PaymentMethod::count());
    }
}
