<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    /**
     * Seed settings default — DATABASE.md §8 & §3.13.
     * firstOrCreate agar seeding ulang tidak menimpa perubahan user.
     */
    public function run(): void
    {
        $defaults = [
            'store_name' => 'Pitou Cafe',
            'store_logo' => null,
            'store_address' => null,
            'store_phone' => null,
            'store_email' => null,
            'store_instagram' => null,
            'receipt_footer' => null,
            'tax_enabled' => '0',
            'tax_name' => 'Pajak',
            'tax_percent' => '0',
            'rounding_method' => 'none',
            // Fase 16 — kirim struk via WhatsApp, default OFF (PRD 5.5, 5.15)
            'whatsapp_enabled' => '0',
        ];

        foreach ($defaults as $key => $value) {
            Setting::query()->firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
