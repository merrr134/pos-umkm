<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Owner/Admin dijaga middleware role pada route
    }

    /**
     * Validasi simpan pembelian (Fase 9): supplier wajib (tidak boleh
     * yang terhapus), minimal 1 item, qty ≥ 1, harga modal > 0,
     * produk tidak boleh duplikat. Subtotal/total dihitung server.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'supplier_id' => [
                'required',
                'integer',
                Rule::exists('suppliers', 'id')->whereNull('deleted_at'),
            ],
            'purchase_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.cost_price' => ['required', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'supplier_id.required' => 'Supplier wajib dipilih.',
            'supplier_id.exists' => 'Supplier tidak ditemukan.',
            'purchase_date.required' => 'Tanggal pembelian wajib diisi.',
            'items.required' => 'Minimal satu item pembelian.',
            'items.min' => 'Minimal satu item pembelian.',
            'items.*.product_id.required' => 'Produk wajib dipilih.',
            'items.*.product_id.distinct' => 'Produk tidak boleh duplikat dalam satu pembelian.',
            'items.*.quantity.min' => 'Qty minimal 1.',
            'items.*.cost_price.min' => 'Harga modal harus lebih dari 0.',
        ];
    }
}
