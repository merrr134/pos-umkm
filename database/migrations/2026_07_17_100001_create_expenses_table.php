<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabel expenses — DATABASE.md §3.11 + kolom `title` (judul wajib,
     * Fase 9). Penamaan `notes`/`receipt_path` mengikuti spesifikasi
     * Fase 9 (DATABASE.md menyebut `description`/`receipt_image`).
     * Pengeluaran operasional — tidak menyentuh stok sama sekali.
     */
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('expense_category_id')->constrained()->restrictOnDelete();
            $table->string('expense_number', 30)->unique();
            $table->date('expense_date')->index();
            $table->string('title', 100);
            $table->unsignedInteger('amount');
            $table->enum('payment_method', ['tunai', 'qris', 'transfer', 'kartu']);
            $table->text('notes')->nullable();
            $table->string('receipt_path')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
