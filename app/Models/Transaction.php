<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id',
    'client_uuid',
    'invoice_number',
    'subtotal',
    'discount',
    'tax_name',
    'tax_percent',
    'tax_amount',
    'rounding',
    'total',
    'payment_method',
    'paid_amount',
    'change_amount',
    'customer_phone',
    'status',
    'cancel_reason',
    'cancelled_by',
    'cancelled_at',
    'sync_status',
])]
class Transaction extends Model
{
    public const STATUS_PAID = 'paid';

    public const STATUS_CANCELLED = 'cancelled';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'subtotal' => 'integer',
            'discount' => 'integer',
            'tax_percent' => 'float',
            'tax_amount' => 'integer',
            'rounding' => 'integer',
            'total' => 'integer',
            'paid_amount' => 'integer',
            'change_amount' => 'integer',
            'cancelled_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    /** Owner yang membatalkan transaksi (PRD 5.4). */
    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    /**
     * Nomor transaksi berikutnya `TRX-YYYYMMDD-0001` (PRD Bab 12) —
     * urutan reset harian. Wajib dipanggil di dalam DB::transaction();
     * lockForUpdate + unique index menjaga nomor tidak pernah dobel
     * (bentrok → retry di pemanggil, DATABASE.md Bab 10).
     */
    public static function nextInvoiceNumber(): string
    {
        $prefix = 'TRX-'.now()->format('Ymd').'-';

        $last = static::query()
            ->where('invoice_number', 'like', $prefix.'%')
            ->lockForUpdate()
            ->max('invoice_number');

        $sequence = $last !== null ? ((int) substr($last, -4)) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Nilai pembulatan (bisa +/−) sesuai rounding_method di settings
     * (PRD 5.13.B): none / up|down|nearest kelipatan 100|500|1000.
     */
    public static function calculateRounding(int $amount, ?string $method): int
    {
        if ($method === null || $method === 'none' || ! str_contains($method, '_')) {
            return 0;
        }

        [$direction, $step] = explode('_', $method, 2);
        $step = (int) $step;

        if ($step <= 0) {
            return 0;
        }

        $rounded = match ($direction) {
            'up' => (int) (ceil($amount / $step) * $step),
            'down' => (int) (floor($amount / $step) * $step),
            'nearest' => (int) (round($amount / $step) * $step),
            default => $amount,
        };

        return $rounded - $amount;
    }
}
