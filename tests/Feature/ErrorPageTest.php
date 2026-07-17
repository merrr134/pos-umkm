<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Fase 12 — halaman error ramah (PRD Bab 9): 404 & 403 merender
 * halaman Error Inertia (bukan error mentah / blank screen),
 * sementara request JSON tetap menerima respons JSON.
 */
class ErrorPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_unknown_url_renders_friendly_404_page(): void
    {
        $this->actingAs(User::factory()->owner()->create())
            ->get('/halaman-tidak-ada')
            ->assertNotFound()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Error')
                ->where('status', 404));
    }

    public function test_missing_model_renders_friendly_404_page(): void
    {
        $this->actingAs(User::factory()->owner()->create())
            ->get('/pengeluaran?page=1') // sanity: halaman valid tetap 200
            ->assertOk();

        $this->actingAs(User::factory()->owner()->create())
            ->getJson('/pembelian/999999')
            ->assertNotFound()
            ->assertJsonStructure(['message']); // JSON tetap JSON
    }

    public function test_forbidden_access_renders_friendly_403_page(): void
    {
        $this->actingAs(User::factory()->create()) // kasir
            ->get('/produk')
            ->assertForbidden()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Error')
                ->where('status', 403));
    }

    public function test_guest_still_redirected_not_error_page(): void
    {
        // Middleware auth tetap redirect ke login, bukan halaman error
        $this->get('/produk')->assertRedirect('/login');
    }
}
