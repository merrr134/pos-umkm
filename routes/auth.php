<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Auth Routes — Pitou Cafe POS
|--------------------------------------------------------------------------
| Sesuai PRD 5.1: hanya Login (username + password) dan Logout.
| Registrasi publik, reset password via email, dan verifikasi email
| tidak ada di PRD — user dikelola oleh Owner (Fase 11).
*/

Route::middleware('guest')->group(function () {
    Route::get('login', [AuthenticatedSessionController::class, 'create'])
        ->name('login');

    Route::post('login', [AuthenticatedSessionController::class, 'store']);
});

Route::middleware('auth')->group(function () {
    Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
        ->name('logout');
});
