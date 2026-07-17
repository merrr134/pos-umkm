<?php

namespace App\Policies;

use App\Models\Supplier;
use App\Models\User;

class SupplierPolicy
{
    /**
     * RBAC Supplier (Fase 8): Owner CRUD penuh + restore;
     * Admin tambah/edit/lihat; Kasir view only.
     */
    public function viewAny(User $user): bool
    {
        return true; // semua role boleh melihat (kasir view only)
    }

    public function create(User $user): bool
    {
        return in_array($user->role, [User::ROLE_OWNER, User::ROLE_ADMIN], true);
    }

    public function update(User $user, Supplier $supplier): bool
    {
        return in_array($user->role, [User::ROLE_OWNER, User::ROLE_ADMIN], true);
    }

    /** Soft delete — hanya Owner. */
    public function delete(User $user, Supplier $supplier): bool
    {
        return $user->role === User::ROLE_OWNER;
    }

    /** Restore supplier terhapus — hanya Owner, Admin tidak. */
    public function restore(User $user, Supplier $supplier): bool
    {
        return $user->role === User::ROLE_OWNER;
    }

    /** Melihat daftar supplier terhapus (trash) — hanya Owner. */
    public function viewTrash(User $user): bool
    {
        return $user->role === User::ROLE_OWNER;
    }
}
