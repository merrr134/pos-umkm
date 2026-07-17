<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductRequest extends FormRequest
{
    /**
     * Validasi Produk — PRD 5.6.
     * Harga Modal (cost_price) sengaja tidak divalidasi/diterima:
     * diisi otomatis dari Pembelian (Fase 8).
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'category_id' => [
                'required',
                Rule::exists('categories', 'id')->whereNull('deleted_at'),
            ],
            'barcode' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('products', 'barcode')
                    ->ignore($this->route('product')),
            ],
            'price' => ['required', 'integer', 'min:1', 'max:4294967295'],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['required', Rule::in(['aktif', 'habis'])],
            'track_stock' => ['required', 'boolean'],
            'stock' => ['exclude_unless:track_stock,true', 'required', 'integer', 'min:0'],
            'min_stock' => ['exclude_unless:track_stock,true', 'nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama produk wajib diisi.',
            'name.max' => 'Nama produk maksimal 100 karakter.',
            'category_id.required' => 'Kategori wajib dipilih.',
            'category_id.exists' => 'Kategori tidak valid.',
            'barcode.unique' => 'Barcode sudah digunakan produk lain.',
            'price.required' => 'Harga jual wajib diisi.',
            'price.integer' => 'Harga jual harus berupa angka.',
            'price.min' => 'Harga jual harus lebih dari 0.',
            'photo.image' => 'Foto harus berupa gambar.',
            'photo.mimes' => 'Format foto harus jpg, jpeg, png, atau webp.',
            'photo.max' => 'Ukuran foto maksimal 2 MB.',
            'status.in' => 'Status harus Aktif atau Habis.',
            'stock.required' => 'Jumlah stok wajib diisi saat Kelola Stok aktif.',
            'stock.integer' => 'Jumlah stok harus berupa angka.',
            'stock.min' => 'Jumlah stok tidak boleh negatif.',
            'min_stock.integer' => 'Minimum stok harus berupa angka.',
            'min_stock.min' => 'Minimum stok tidak boleh negatif.',
        ];
    }
}
