<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabel transactions — DATABASE.md §3.8.
     * Immutable (tanpa soft delete); koreksi hanya lewat status=cancelled.
     * Snapshot pajak & pembulatan agar transaksi lama tidak berubah
     * saat pengaturan diubah (PRD 5.13.B).
     */
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->char('client_uuid', 36)->unique();
            $table->string('invoice_number', 30)->unique();
            $table->unsignedInteger('subtotal');
            $table->unsignedInteger('discount')->default(0);
            $table->string('tax_name', 50)->nullable();
            $table->decimal('tax_percent', 5, 2)->default(0);
            $table->unsignedInteger('tax_amount')->default(0);
            $table->integer('rounding')->default(0);
            $table->unsignedInteger('total');
            $table->enum('payment_method', ['tunai', 'qris', 'transfer', 'kartu'])->index();
            $table->unsignedInteger('paid_amount')->nullable();
            $table->unsignedInteger('change_amount')->nullable();
            $table->string('customer_phone', 20)->nullable();
            $table->enum('status', ['paid', 'cancelled'])->default('paid')->index();
            $table->string('cancel_reason', 255)->nullable();
            $table->foreignId('cancelled_by')
                ->nullable()
                ->constrained('users')
                ->restrictOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->enum('sync_status', ['synced', 'pending'])->default('synced')->index();
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
