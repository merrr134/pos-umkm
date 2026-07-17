<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RestockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Owner/Admin dijaga middleware role pada route
    }

    /**
     * Validasi restock manual (Fase 7): jumlah minimal 1,
     * catatan opsional.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'quantity' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'quantity.required' => 'Jumlah stok wajib diisi.',
            'quantity.min' => 'Jumlah restock minimal 1.',
            'note.max' => 'Catatan maksimal 255 karakter.',
        ];
    }
}
