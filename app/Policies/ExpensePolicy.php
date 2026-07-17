<?php

namespace App\Policies;

use App\Models\Expense;
use App\Models\User;

class ExpensePolicy
{
    /**
     * RBAC Pengeluaran (Fase 9): Owner CRUD penuh + restore;
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

    public function update(User $user, Expense $expense): bool
    {
        return in_array($user->role, [User::ROLE_OWNER, User::ROLE_ADMIN], true);
    }

    /** Soft delete — hanya Owner. */
    public function delete(User $user, Expense $expense): bool
    {
        return $user->role === User::ROLE_OWNER;
    }

    /** Restore pengeluaran terhapus — hanya Owner, Admin tidak. */
    public function restore(User $user, Expense $expense): bool
    {
        return $user->role === User::ROLE_OWNER;
    }

    /** Melihat daftar pengeluaran terhapus (trash) — hanya Owner. */
    public function viewTrash(User $user): bool
    {
        return $user->role === User::ROLE_OWNER;
    }
}
