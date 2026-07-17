<?php

namespace App\Http\Requests\Settings;

use App\Models\Setting;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTaxRequest extends FormRequest
{
    /**
     * Validasi Pajak & Biaya — PRD 5.13.B (persentase 0–100).
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tax_enabled' => ['required', 'boolean'],
            'tax_name' => ['nullable', 'required_if:tax_enabled,true', 'string', 'max:50'],
            'tax_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'rounding_method' => ['required', Rule::in(Setting::ROUNDING_METHODS)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'tax_name.required_if' => 'Nama pajak wajib diisi saat pajak diaktifkan.',
            'tax_percent.required' => 'Persentase pajak wajib diisi.',
            'tax_percent.numeric' => 'Persentase pajak harus berupa angka.',
            'tax_percent.min' => 'Persentase pajak minimal 0.',
            'tax_percent.max' => 'Persentase pajak maksimal 100.',
            'rounding_method.in' => 'Metode pembulatan tidak valid.',
        ];
    }
}
