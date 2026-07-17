<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fase 7 — Manajemen Stok: tambah nilai enum `restock`
     * (restock manual) dan `cancel_transaction` (pengembalian stok
     * saat pembatalan) pada stock_movements.type.
     * Nilai lama (sale/purchase/adjustment) tetap dipertahankan.
     */
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->enum('type', [
                'sale',
                'purchase',
                'adjustment',
                'restock',
                'cancel_transaction',
            ])->change();
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->enum('type', ['sale', 'purchase', 'adjustment'])->change();
        });
    }
};
