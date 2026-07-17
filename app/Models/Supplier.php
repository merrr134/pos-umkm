<?php

namespace App\Models;

use Database\Factories\SupplierFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'code',
    'name',
    'contact_person',
    'phone',
    'email',
    'address',
    'notes',
    'status',
])]
class Supplier extends Model
{
    /** @use HasFactory<SupplierFactory> */
    use HasFactory, SoftDeletes;

    public const STATUS_AKTIF = 'aktif';

    public const STATUS_NONAKTIF = 'nonaktif';

    /**
     * Kode supplier berikutnya `SUP-0001` (Fase 8) — urut global,
     * tidak reset. Wajib dipanggil di dalam DB::transaction();
     * unique index sebagai pengaman terakhir (bentrok → retry di
     * pemanggil, pola sama dengan nomor transaksi).
     * withTrashed: kode supplier terhapus tidak boleh dipakai ulang.
     */
    public static function nextCode(): string
    {
        $last = static::withTrashed()
            ->lockForUpdate()
            ->orderByRaw('length(code) desc')
            ->orderByDesc('code')
            ->value('code');

        $sequence = $last !== null ? ((int) substr($last, 4)) + 1 : 1;

        return 'SUP-'.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}
