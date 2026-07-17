<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateStoreProfileRequest;
use App\Http\Requests\Settings\UpdateTaxRequest;
use App\Http\Requests\Settings\UpdateWhatsappRequest;
use App\Models\PaymentMethod;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class SettingController extends Controller
{
    /**
     * Halaman Pengaturan (PRD 5.13) — tab Profil Toko,
     * Pajak & Biaya, Metode Pembayaran.
     */
    public function index(): Response
    {
        $settings = Setting::asArray();

        return Inertia::render('Pengaturan/Index', [
            'settings' => [
                'store_name' => $settings['store_name'] ?? 'Pitou Cafe',
                'store_logo' => ($settings['store_logo'] ?? null)
                    ? Storage::disk('public')->url($settings['store_logo'])
                    : null,
                'store_address' => $settings['store_address'] ?? null,
                'store_phone' => $settings['store_phone'] ?? null,
                'store_email' => $settings['store_email'] ?? null,
                'store_instagram' => $settings['store_instagram'] ?? null,
                'receipt_footer' => $settings['receipt_footer'] ?? null,
                'tax_enabled' => ($settings['tax_enabled'] ?? '0') === '1',
                'tax_name' => $settings['tax_name'] ?? 'Pajak',
                'tax_percent' => (float) ($settings['tax_percent'] ?? 0),
                'rounding_method' => $settings['rounding_method'] ?? 'none',
                // Fase 16 — WhatsApp kirim struk (default OFF)
                'whatsapp_enabled' => ($settings['whatsapp_enabled'] ?? '0') === '1',
            ],
            'paymentMethods' => PaymentMethod::query()
                ->orderBy('id')
                ->get(['id', 'name', 'code', 'is_active']),
        ]);
    }

    /**
     * Simpan Profil Toko (Owner only) — PRD 5.13.A.
     */
    public function updateStoreProfile(UpdateStoreProfileRequest $request): RedirectResponse
    {
        $data = $request->validated();

        if ($request->hasFile('logo')) {
            $oldLogo = Setting::getValue('store_logo');

            $path = $request->file('logo')->store('logo', 'public');
            Setting::setValue('store_logo', $path);

            if ($oldLogo !== null && $oldLogo !== $path) {
                Storage::disk('public')->delete($oldLogo);
            }
        }

        Setting::setValue('store_name', $data['store_name']);
        Setting::setValue('store_address', $data['store_address'] ?? null);
        Setting::setValue('store_phone', $data['store_phone'] ?? null);
        Setting::setValue('store_email', $data['store_email'] ?? null);
        Setting::setValue('store_instagram', $data['store_instagram'] ?? null);
        Setting::setValue('receipt_footer', $data['receipt_footer'] ?? null);

        app(\App\Services\ActivityLogService::class)->log(
            \App\Services\ActivityLogService::MODULE_PENGATURAN,
            'Edit Pengaturan',
            'Mengubah Profil Toko',
        );

        return back()->with('success', 'Profil toko berhasil disimpan.');
    }

    /**
     * Simpan Pajak & Biaya — PRD 5.13.B.
     */
    public function updateTax(UpdateTaxRequest $request): RedirectResponse
    {
        $data = $request->validated();

        Setting::setValue('tax_enabled', $data['tax_enabled'] ? '1' : '0');

        if (isset($data['tax_name']) && $data['tax_name'] !== '') {
            Setting::setValue('tax_name', $data['tax_name']);
        }

        Setting::setValue('tax_percent', (string) $data['tax_percent']);
        Setting::setValue('rounding_method', $data['rounding_method']);

        app(\App\Services\ActivityLogService::class)->log(
            \App\Services\ActivityLogService::MODULE_PENGATURAN,
            'Edit Pengaturan',
            'Mengubah Pajak & Biaya',
        );

        return back()->with('success', 'Pengaturan pajak berhasil disimpan.');
    }

    /**
     * Simpan pengaturan WhatsApp (Fase 16) — toggle kirim struk digital.
     * Owner & Admin (grup pengaturan). Default OFF; saat OFF, tombol
     * kirim WhatsApp tidak muncul di UI (PRD 5.5).
     */
    public function updateWhatsapp(UpdateWhatsappRequest $request): RedirectResponse
    {
        $data = $request->validated();

        Setting::setValue('whatsapp_enabled', $data['whatsapp_enabled'] ? '1' : '0');

        app(\App\Services\ActivityLogService::class)->log(
            \App\Services\ActivityLogService::MODULE_PENGATURAN,
            'Edit Pengaturan',
            'Mengubah pengaturan WhatsApp ('.($data['whatsapp_enabled'] ? 'aktif' : 'nonaktif').')',
        );

        return back()->with('success', 'Pengaturan WhatsApp berhasil disimpan.');
    }
}
