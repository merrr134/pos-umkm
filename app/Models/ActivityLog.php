<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

#[Fillable([
    'user_id',
    'role',
    'activity',
    'module',
    'description',
    'ip_address',
    'user_agent',
])]
class ActivityLog extends Model
{
    /**
     * Append-only (DATABASE.md §3.14 & PRD 5.13.F) — model menolak
     * update/delete di level aplikasi; tidak ada route pengubah.
     */
    protected static function booted(): void
    {
        static::updating(function (): never {
            throw new LogicException('Activity log bersifat append-only dan tidak bisa diubah.');
        });

        static::deleting(function (): never {
            throw new LogicException('Activity log bersifat append-only dan tidak bisa dihapus.');
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
