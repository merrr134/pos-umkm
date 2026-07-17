<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class RoleMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['web', 'auth', 'role:owner'])
            ->get('/_test/owner-only', fn () => response('ok'));
    }

    public function test_guests_are_redirected_to_login(): void
    {
        $response = $this->get('/kasir');

        $response->assertRedirect('/login');
    }

    public function test_all_roles_can_access_kasir(): void
    {
        foreach (['owner', 'admin', 'kasir'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $response = $this->actingAs($user)->get('/kasir');

            $response->assertOk();
        }
    }

    public function test_unauthorized_role_gets_403(): void
    {
        $kasir = User::factory()->create();

        $response = $this->actingAs($kasir)->get('/_test/owner-only');

        $response->assertForbidden();
    }

    public function test_authorized_role_can_access_restricted_route(): void
    {
        $owner = User::factory()->owner()->create();

        $response = $this->actingAs($owner)->get('/_test/owner-only');

        $response->assertOk();
    }
}
