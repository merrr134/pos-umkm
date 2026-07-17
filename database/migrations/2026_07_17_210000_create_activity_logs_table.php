<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabel activity_logs — DATABASE.md §3.14 (user_id, activity,
     * module, ip_address) + kolom aditif spesifikasi Fase 11:
     * role (snapshot saat aksi), description, user_agent.
     * Append-only: tidak pernah diedit/dihapus dari aplikasi.
     */
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('role', 20)->nullable();
            $table->string('activity');
            $table->string('module', 50)->index();
            $table->string('description', 500)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamps();
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
