<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['key', 'value'])]
class Setting extends Model
{
    /**
     * Metode pembulatan yang diizinkan (PRD 5.13.B):
     * tanpa pembulatan / ke atas / ke bawah / terdekat — kelipatan 100/500/1000.
     */
    public const ROUNDING_METHODS = [
        'none',
        'up_100', 'up_500', 'up_1000',
        'down_100', 'down_500', 'down_1000',
        'nearest_100', 'nearest_500', 'nearest_1000',
    ];

    public static function getValue(string $key, ?string $default = null): ?string
    {
        return static::query()->where('key', $key)->value('value') ?? $default;
    }

    public static function setValue(string $key, ?string $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }

    /**
     * Seluruh setting sebagai array key => value.
     *
     * @return array<string, string|null>
     */
    public static function asArray(): array
    {
        return static::query()->pluck('value', 'key')->all();
    }
}
