<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

#[Fillable([
    'category_id',
    'name',
    'barcode',
    'price',
    'cost_price',
    'photo',
    'description',
    'status',
    'track_stock',
    'stock',
    'min_stock',
])]
class Product extends Model
{
    /** @use HasFactory<\Database\Factories\ProductFactory> */
    use HasFactory, SoftDeletes;

    public const STATUS_AKTIF = 'aktif';

    public const STATUS_HABIS = 'habis';

    /**
     * URL publik foto produk (untuk frontend).
     *
     * @var list<string>
     */
    protected $appends = ['photo_url'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'cost_price' => 'integer',
            'track_stock' => 'boolean',
            'stock' => 'integer',
            'min_stock' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function getPhotoUrlAttribute(): ?string
    {
        return $this->photo !== null
            ? Storage::disk('public')->url($this->photo)
            : null;
    }

    /**
     * Produk bisa dijual di Kasir (PRD 5.6) — status aktif dan
     * stoknya masih ada (bila stok dikelola).
     */
    public function isSellable(): bool
    {
        if ($this->status !== self::STATUS_AKTIF) {
            return false;
        }

        return ! $this->track_stock || $this->stock > 0;
    }

    /**
     * Status level stok (Fase 7 — PRD 5.8):
     * untracked (stok tidak dikelola) / habis (≤0) /
     * menipis (≤ minimum stok) / normal.
     */
    public function stockStatus(): string
    {
        if (! $this->track_stock) {
            return 'untracked';
        }

        if ($this->stock <= 0) {
            return 'habis';
        }

        if ($this->min_stock > 0 && $this->stock <= $this->min_stock) {
            return 'menipis';
        }

        return 'normal';
    }

    /**
     * Scope produk yang bisa dipilih di layar Kasir (dipakai Fase 4).
     */
    public function scopeSellable($query)
    {
        return $query
            ->where('status', self::STATUS_AKTIF)
            ->where(function ($query) {
                $query->where('track_stock', false)
                    ->orWhere('stock', '>', 0);
            });
    }
}
