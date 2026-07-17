<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdateWhatsappRequest extends FormRequest
{
    /**
     * Validasi pengaturan WhatsApp (Fase 16) — hanya toggle aktif/nonaktif
     * kirim struk digital via WhatsApp (PRD 5.5). Default OFF.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'whatsapp_enabled' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'whatsapp_enabled.required' => 'Status kirim WhatsApp wajib diisi.',
            'whatsapp_enabled.boolean' => 'Status kirim WhatsApp tidak valid.',
        ];
    }
}
