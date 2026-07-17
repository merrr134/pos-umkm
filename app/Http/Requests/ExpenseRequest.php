<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Owner/Admin dijaga middleware role + ExpensePolicy
    }

    /**
     * Validasi Pengeluaran (Fase 9): tanggal/kategori/judul/nominal/
     * metode wajib, nominal > 0, kategori harus aktif & belum dihapus,
     * metode pembayaran mengikuti yang aktif (PRD 5.10), bukti
     * jpg/jpeg/png/webp/pdf maksimal 5 MB.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'expense_date' => ['required', 'date'],
            'expense_category_id' => [
                'required',
                'integer',
                Rule::exists('expense_categories', 'id')
                    ->whereNull('deleted_at')
                    ->where('is_active', true),
            ],
            'title' => ['required', 'string', 'max:100'],
            'amount' => ['required', 'integer', 'min:1', 'max:4294967295'],
            'payment_method' => [
                'required',
                Rule::exists('payment_methods', 'code')->where('is_active', true),
            ],
            'notes' => ['nullable', 'string', 'max:500'],
            'receipt' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'expense_date.required' => 'Tanggal pengeluaran wajib diisi.',
            'expense_category_id.required' => 'Kategori wajib dipilih.',
            'expense_category_id.exists' => 'Kategori tidak valid atau sudah nonaktif.',
            'title.required' => 'Judul pengeluaran wajib diisi.',
            'title.max' => 'Judul maksimal 100 karakter.',
            'amount.required' => 'Nominal wajib diisi.',
            'amount.integer' => 'Nominal harus berupa angka.',
            'amount.min' => 'Nominal harus lebih dari 0.',
            'payment_method.required' => 'Metode pembayaran wajib dipilih.',
            'payment_method.exists' => 'Metode pembayaran tidak valid atau nonaktif.',
            'receipt.mimes' => 'Bukti harus berformat jpg, jpeg, png, webp, atau pdf.',
            'receipt.max' => 'Ukuran bukti maksimal 5 MB.',
        ];
    }
}
