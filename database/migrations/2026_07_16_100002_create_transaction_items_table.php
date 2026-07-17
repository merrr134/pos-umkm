<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabel transaction_items — DATABASE.md §3.9.
     * Snapshot product_name / price / cost_price menjaga riwayat & laba
     * tetap akurat meski produk diubah atau di-soft-delete.
     */
    public function up(): void
    {
        Schema::create('transaction_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->string('product_name', 100);
            $table->unsignedInteger('price');
            $table->unsignedInteger('cost_price')->nullable();
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('subtotal');
            $table->string('note', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_items');
    }
};
