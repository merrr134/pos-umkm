<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureUserHasRole::class,
        ]);

        // User yang sudah login diarahkan ke Kasir saat membuka route guest
        $middleware->redirectUsersTo('/kasir');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->expectsJson() || $request->is('api/*'),
        );

        // Fase 12 — halaman error ramah (PRD Bab 9): 403/404 selalu;
        // 500/503 hanya saat debug OFF (dev tetap melihat stack trace).
        // 419 (sesi/CSRF kadaluarsa) → kembali ke login dengan pesan.
        $exceptions->respond(function (Symfony\Component\HttpFoundation\Response $response, Throwable $e, Request $request) {
            $status = $response->getStatusCode();

            if ($request->expectsJson() || $request->is('api/*')) {
                return $response;
            }

            if ($status === 419) {
                return redirect()->guest(route('login'))
                    ->with('status', 'Sesi berakhir, silakan login kembali.');
            }

            $friendly = in_array($status, [403, 404], true)
                || (! config('app.debug') && in_array($status, [500, 503], true));

            if ($friendly) {
                return Inertia\Inertia::render('Error', ['status' => $status])
                    ->toResponse($request)
                    ->setStatusCode($status);
            }

            return $response;
        });
    })->create();
