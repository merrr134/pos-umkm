<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/**
 * Pencatatan Activity Log (Fase 11 — PRD 5.13.F). SEMUA log dicatat
 * lewat service ini — controller cukup satu baris log(). Kegagalan
 * pencatatan tidak pernah menggagalkan aksi utamanya (rescue).
 */
class ActivityLogService
{
    public const MODULE_AUTH = 'Auth';

    public const MODULE_USER = 'User';

    public const MODULE_PRODUK = 'Produk';

    public const MODULE_SUPPLIER = 'Supplier';

    public const MODULE_PEMBELIAN = 'Pembelian';

    public const MODULE_PENGELUARAN = 'Pengeluaran';

    public const MODULE_TRANSAKSI = 'Transaksi';

    public const MODULE_PENGATURAN = 'Pengaturan';

    public const MODULE_BACKUP = 'Backup';

    /** Daftar modul — untuk dropdown filter halaman Activity Log. */
    public const MODULES = [
        self::MODULE_AUTH,
        self::MODULE_USER,
        self::MODULE_PRODUK,
        self::MODULE_SUPPLIER,
        self::MODULE_PEMBELIAN,
        self::MODULE_PENGELUARAN,
        self::MODULE_TRANSAKSI,
        self::MODULE_PENGATURAN,
        self::MODULE_BACKUP,
    ];

    /**
     * Catat satu aktivitas atas nama user login (atau $user eksplisit
     * — dipakai saat logout, sebelum sesi dihancurkan).
     */
    public function log(
        string $module,
        string $activity,
        ?string $description = null,
        ?User $user = null,
    ): void {
        $user ??= Auth::user();

        if ($user === null) {
            return;
        }

        rescue(fn () => ActivityLog::create([
            'user_id' => $user->id,
            'role' => $user->role,
            'module' => $module,
            'activity' => $activity,
            'description' => $description !== null ? Str::limit($description, 490) : null,
            'ip_address' => request()->ip(),
            'user_agent' => Str::limit((string) request()->userAgent(), 250) ?: null,
        ]), report: false);
    }
}
