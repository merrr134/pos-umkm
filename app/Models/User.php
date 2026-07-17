<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;

#[Fillable([
    'name',
    'username',
    'password',
    'role',
    'is_active',
    'photo',
    'last_login_at',
    'last_login_ip',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, SoftDeletes;

    public const ROLE_OWNER = 'owner';

    public const ROLE_ADMIN = 'admin';

    public const ROLE_KASIR = 'kasir';

    /** Seluruh role sistem — enum users.role (DATABASE.md §3.1). */
    public const ROLES = [
        self::ROLE_OWNER,
        self::ROLE_ADMIN,
        self::ROLE_KASIR,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    /** URL publik foto profil (null → frontend memakai avatar default). */
    public function photoUrl(): ?string
    {
        return $this->photo !== null
            ? Storage::disk('public')->url($this->photo)
            : null;
    }

    /**
     * Owner aktif terakhir tidak boleh dinonaktifkan / diganti role
     * (PRD Bab 3 & 5.13.D).
     */
    public function isLastActiveOwner(): bool
    {
        return $this->role === self::ROLE_OWNER
            && $this->is_active
            && static::query()
                ->where('role', self::ROLE_OWNER)
                ->where('is_active', true)
                ->whereKeyNot($this->id)
                ->doesntExist();
    }
}
