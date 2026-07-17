<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StockAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Owner/Admin dijaga middleware role pada route
    }

    /**
     * Validasi penyesuaian stok (Fase 7 — PRD 5.8):
     * jumlah minimal 1, alasan wajib (rusak/hilang/koreksi/dll).
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['tambah', 'kurang'])],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.required' => 'Jenis penyesuaian wajib dipilih.',
            'type.in' => 'Jenis penyesuaian tidak valid.',
            'quantity.required' => 'Jumlah wajib diisi.',
            'quantity.min' => 'Jumlah penyesuaian minimal 1.',
            'reason.required' => 'Alasan penyesuaian wajib diisi.',
            'reason.max' => 'Alasan maksimal 255 karakter.',
        ];
    }
}
