<?php

namespace App\Http\Middleware;

use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        // Profil Toko dari tabel settings (PRD 5.13.A) — dipakai di
        // Login, Splash, Header, dan nanti Struk & Laporan.
        // rescue: fallback default bila migration belum dijalankan.
        $settings = rescue(fn () => Setting::asArray(), [], report: false);

        return [
            ...parent::share($request),
            // Field eksplisit — password/hash tidak pernah ikut terkirim
            'auth' => [
                'user' => $request->user() !== null ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'username' => $request->user()->username,
                    'role' => $request->user()->role,
                    'is_active' => $request->user()->is_active,
                    'photo_url' => $request->user()->photoUrl(),
                ] : null,
            ],
            'store' => [
                'name' => ($settings['store_name'] ?? null) ?: 'Pitou Cafe',
                'logo' => ($settings['store_logo'] ?? null)
                    ? Storage::disk('public')->url($settings['store_logo'])
                    : null,
            ],
            // Fase 16 — status kirim struk WhatsApp; menentukan tampil/
            // tidaknya tombol "Kirim via WhatsApp" di seluruh halaman.
            'whatsapp' => [
                'enabled' => ($settings['whatsapp_enabled'] ?? '0') === '1',
            ],
            'flash' => [
                'success' => $request->session()->get('success'),
                // Password hasil reset — ditampilkan sekali (Fase 11)
                'new_password' => $request->session()->get('new_password'),
            ],
            'session' => [
                'lifetime' => (int) config('session.lifetime'),
            ],
        ];
    }
}
