<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * RBAC Manajemen Pengguna (Fase 11): Owner full access;
     * Admin view only; Kasir tidak punya akses (403 via route).
     */
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [User::ROLE_OWNER, User::ROLE_ADMIN], true);
    }

    public function create(User $user): bool
    {
        return $user->role === User::ROLE_OWNER;
    }

    public function update(User $user, User $target): bool
    {
        return $user->role === User::ROLE_OWNER;
    }

    /** Reset password user lain — hanya Owner. */
    public function resetPassword(User $user, User $target): bool
    {
        return $user->role === User::ROLE_OWNER;
    }
}
