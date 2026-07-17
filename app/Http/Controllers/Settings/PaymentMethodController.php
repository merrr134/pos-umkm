<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PaymentMethodController extends Controller
{
    /**
     * Aktif/nonaktifkan metode pembayaran — PRD 5.13.C.
     * Minimal satu metode harus tetap aktif.
     */
    public function update(Request $request, PaymentMethod $paymentMethod): RedirectResponse
    {
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $deactivating = ! $validated['is_active'] && $paymentMethod->is_active;

        if ($deactivating && PaymentMethod::query()
            ->where('is_active', true)
            ->whereKeyNot($paymentMethod->id)
            ->doesntExist()) {
            throw ValidationException::withMessages([
                'is_active' => 'Minimal satu metode pembayaran harus aktif.',
            ]);
        }

        $paymentMethod->update(['is_active' => $validated['is_active']]);

        app(\App\Services\ActivityLogService::class)->log(
            \App\Services\ActivityLogService::MODULE_PENGATURAN,
            'Edit Pengaturan',
            'Mengubah Metode Pembayaran: '.$paymentMethod->name,
        );

        return back()->with(
            'success',
            $paymentMethod->name.' berhasil '.($validated['is_active'] ? 'diaktifkan.' : 'dinonaktifkan.'),
        );
    }
}
