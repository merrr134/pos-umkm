<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class OwnerSeeder extends Seeder
{
    /**
     * Seed Owner default sesuai DATABASE.md §8
     * (username `owner`, password diganti saat pertama login).
     */
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['username' => 'owner'],
            [
                'name' => 'Owner',
                'password' => 'password',
                'role' => User::ROLE_OWNER,
                'is_active' => true,
            ],
        );
    }
}
