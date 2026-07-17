<?php

namespace App\Models;

use Database\Factories\ExpenseFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

#[Fillable([
    'user_id',
    'expense_category_id',
    'expense_number',
    'expense_date',
    'title',
    'amount',
    'payment_method',
    'notes',
    'receipt_path',
])]
class Expense extends Model
{
    /** @use HasFactory<ExpenseFactory> */
    use HasFactory, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expense_date' => 'date',
            'amount' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ExpenseCategory::class, 'expense_category_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** URL publik bukti pengeluaran (null jika tanpa bukti). */
    public function receiptUrl(): ?string
    {
        return $this->receipt_path !== null
            ? Storage::disk('public')->url($this->receipt_path)
            : null;
    }

    /** Bukti berupa PDF → detail menampilkan link unduh, bukan preview. */
    public function receiptIsPdf(): bool
    {
        return $this->receipt_path !== null
            && str_ends_with(strtolower($this->receipt_path), '.pdf');
    }

    /**
     * Nomor pengeluaran berikutnya `EXP-YYYYMMDD-0001` (PRD Bab 12) —
     * urutan reset harian. Wajib dipanggil di dalam DB::transaction();
     * lockForUpdate + unique index menjaga nomor tidak pernah dobel
     * (bentrok → retry di pemanggil, pola sama nomor transaksi).
     * withTrashed: nomor pengeluaran terhapus tidak dipakai ulang.
     */
    public static function nextExpenseNumber(): string
    {
        $prefix = 'EXP-'.now()->format('Ymd').'-';

        $last = static::withTrashed()
            ->where('expense_number', 'like', $prefix.'%')
            ->lockForUpdate()
            ->max('expense_number');

        $sequence = $last !== null ? ((int) substr($last, -4)) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}
