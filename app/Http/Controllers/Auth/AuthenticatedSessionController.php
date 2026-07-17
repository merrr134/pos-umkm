<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Services\ActivityLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Login', [
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        // Jejak login terakhir (Fase 11) — otomatis tiap login sukses
        $request->user()->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_AUTH,
            'Login',
            "Login sebagai {$request->user()->username}",
        );

        // Setelah login berhasil → langsung ke halaman Kasir (PRD 5.1)
        return redirect()->intended(route('kasir', absolute: false));
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        // Catat sebelum sesi dihancurkan (user masih tersedia)
        if ($request->user() !== null) {
            app(ActivityLogService::class)->log(
                ActivityLogService::MODULE_AUTH,
                'Logout',
                "Logout {$request->user()->username}",
                $request->user(),
            );
        }

        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}
