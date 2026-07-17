<?php

namespace Database\Seeders;

use App\Models\PaymentMethod;
use Illuminate\Database\Seeder;

class PaymentMethodSeeder extends Seeder
{
    /**
     * Seed metode pembayaran default — DATABASE.md §8
     * (Tunai, QRIS, Transfer Bank aktif; Kartu default nonaktif).
     */
    public function run(): void
    {
        $methods = [
            ['code' => 'tunai', 'name' => 'Tunai', 'is_active' => true],
            ['code' => 'qris', 'name' => 'QRIS', 'is_active' => true],
            ['code' => 'transfer', 'name' => 'Transfer Bank', 'is_active' => true],
            ['code' => 'kartu', 'name' => 'Kartu Debit/Kredit', 'is_active' => false],
        ];

        foreach ($methods as $method) {
            PaymentMethod::query()->firstOrCreate(
                ['code' => $method['code']],
                ['name' => $method['name'], 'is_active' => $method['is_active']],
            );
        }
    }
}
