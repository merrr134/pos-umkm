<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fase 11 — kolom tambahan users di luar DATABASE.md §3.1:
     * foto profil + jejak login terakhir (last_login_at/ip diupdate
     * otomatis setiap login sukses). Struktur autentikasi tidak
     * berubah; enum role tetap owner/admin/kasir sesuai DATABASE.md.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('photo')->nullable()->after('is_active');
            $table->timestamp('last_login_at')->nullable()->after('photo');
            $table->string('last_login_ip', 45)->nullable()->after('last_login_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['photo', 'last_login_at', 'last_login_ip']);
        });
    }
};
