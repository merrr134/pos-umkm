<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'supplier_id',
    'user_id',
    'invoice_number',
    'purchase_date',
    'subtotal',
    'discount',
    'tax',
    'total',
    'notes',
])]
class Purchase extends Model
{
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'subtotal' => 'integer',
            'discount' => 'integer',
            'tax' => 'integer',
            'total' => 'integer',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    /**
     * Nomor pembelian berikutnya `PUR-YYYYMMDD-0001` (PRD Bab 12) —
     * urutan reset harian. Wajib dipanggil di dalam DB::transaction();
     * lockForUpdate + unique index menjaga nomor tidak pernah dobel
     * (bentrok → retry di pemanggil, pola sama nomor transaksi).
     */
    public static function nextInvoiceNumber(): string
    {
        $prefix = 'PUR-'.now()->format('Ymd').'-';

        $last = static::query()
            ->where('invoice_number', 'like', $prefix.'%')
            ->lockForUpdate()
            ->max('invoice_number');

        $sequence = $last !== null ? ((int) substr($last, -4)) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}
