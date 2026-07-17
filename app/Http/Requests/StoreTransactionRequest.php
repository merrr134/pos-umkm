<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validasi simpan transaksi (PRD 5.3) — harga & pajak tidak pernah
     * dipercaya dari client, dihitung ulang di server.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
            'discount_type' => ['nullable', Rule::in(['nominal', 'percent'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['required', Rule::in(['tunai', 'qris', 'transfer', 'kartu'])],
            'paid_amount' => ['nullable', 'required_if:payment_method,tunai', 'integer', 'min:0'],
            'customer_phone' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s]{6,20}$/'],
            // Fase 15 — transaksi offline: UUID dari client untuk
            // deduplication saat sinkronisasi (DATABASE.md §3.8)
            'client_uuid' => ['nullable', 'uuid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'items.required' => 'Keranjang masih kosong.',
            'paid_amount.required_if' => 'Uang pelanggan wajib diisi untuk pembayaran tunai.',
            'customer_phone.regex' => 'Format nomor WhatsApp tidak valid.',
        ];
    }
}
