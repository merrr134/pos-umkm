<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_default_is_seeded_and_can_login(): void
    {
        $this->seed();

        $this->assertDatabaseHas('users', [
            'username' => 'owner',
            'role' => User::ROLE_OWNER,
            'is_active' => true,
        ]);

        $response = $this->post('/login', [
            'username' => 'owner',
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('kasir', absolute: false));
    }
}
