<?php

namespace App\Policies;

use App\Models\Transaction;
use App\Models\User;

class TransactionPolicy
{
    /**
     * Kasir hanya boleh melihat transaksi miliknya sendiri;
     * Admin & Owner melihat seluruh transaksi (PRD 5.11).
     */
    public function view(User $user, Transaction $transaction): bool
    {
        if ($user->role === User::ROLE_KASIR) {
            return $transaction->user_id === $user->id;
        }

        return true;
    }

    /**
     * Hanya Owner yang dapat membatalkan transaksi — audit-sensitive
     * (PRD 5.4). Admin dan Kasir tidak boleh.
     */
    public function cancel(User $user, Transaction $transaction): bool
    {
        return $user->role === User::ROLE_OWNER;
    }
}
