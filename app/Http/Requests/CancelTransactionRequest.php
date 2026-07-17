<?php

namespace App\Http\Requests;

use App\Models\Transaction;
use Illuminate\Foundation\Http\FormRequest;

class CancelTransactionRequest extends FormRequest
{
    /**
     * Hanya Owner yang boleh membatalkan (PRD 5.4) — dicek via
     * TransactionPolicy::cancel.
     */
    public function authorize(): bool
    {
        $transaction = $this->route('transaction');

        return $transaction instanceof Transaction
            && $this->user()->can('cancel', $transaction);
    }

    /**
     * Alasan pembatalan wajib diisi, tidak boleh kosong (PRD 5.4).
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'cancel_reason' => ['required', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'cancel_reason.required' => 'Alasan pembatalan wajib diisi.',
            'cancel_reason.max' => 'Alasan pembatalan maksimal 255 karakter.',
        ];
    }
}
