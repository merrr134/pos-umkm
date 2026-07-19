<?php

namespace App\Providers;

use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // Produksi di belakang TLS (APP_URL https): paksa semua URL yang
        // dibuat memakai https agar aset tidak jadi http (mixed content →
        // halaman putih). Aman untuk lokal (APP_URL http → tidak dipaksa).
        if (str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        // Password minimal 8 karakter (PRD Bab 13 — Security)
        Password::defaults(fn () => Password::min(8));
    }
}
