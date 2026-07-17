<?php

namespace Database\Seeders;

use App\Models\ExpenseCategory;
use Illuminate\Database\Seeder;

class ExpenseCategorySeeder extends Seeder
{
    /**
     * Seed kategori pengeluaran default — gabungan DATABASE.md §8
     * (Listrik, Air, Internet/WiFi, Gaji Karyawan, Sewa, Perlengkapan
     * Kebersihan, Transportasi, Lainnya) + kategori minimal Fase 9
     * (Gas, ATK, Peralatan, Maintenance). Kategori dinamis — bisa
     * ditambah/diedit/dinonaktifkan dari UI (PRD 5.10).
     */
    public function run(): void
    {
        $names = [
            'Listrik',
            'Air',
            'Internet/WiFi',
            'Gaji Karyawan',
            'Sewa',
            'Perlengkapan Kebersihan',
            'Transportasi',
            'Gas',
            'ATK',
            'Peralatan',
            'Maintenance',
            'Lainnya',
        ];

        foreach ($names as $name) {
            ExpenseCategory::query()->firstOrCreate(['name' => $name]);
        }
    }
}
