<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabel products — DATABASE.md §3.3.
     * FK category_id → categories RESTRICT; barcode unique nullable;
     * cost_price nullable (auto dari pembelian — Fase 8, PRD 5.6).
     */
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->string('name', 100);
            $table->string('barcode', 50)->nullable()->unique();
            $table->unsignedInteger('price');
            $table->unsignedInteger('cost_price')->nullable();
            $table->string('photo', 255)->nullable();
            $table->text('description')->nullable();
            $table->enum('status', ['aktif', 'habis'])->default('aktif')->index();
            $table->boolean('track_stock')->default(false);
            $table->integer('stock')->default(0);
            $table->integer('min_stock')->default(0);
            $table->softDeletes();
            $table->timestamps();

            $table->index('category_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
