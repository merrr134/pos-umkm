<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExpenseCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Owner/Admin dijaga middleware role pada route
    }

    /**
     * Validasi Kategori Pengeluaran (PRD 5.10) — nama wajib & unik
     * (termasuk terhadap kategori yang di-soft-delete, karena unique
     * index di kolom name).
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:50',
                Rule::unique('expense_categories', 'name')
                    ->ignore($this->route('expenseCategory')),
            ],
            'is_active' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama kategori wajib diisi.',
            'name.max' => 'Nama kategori maksimal 50 karakter.',
            'name.unique' => 'Nama kategori sudah digunakan.',
        ];
    }
}
