<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTransactionRequest;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Setting;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Services\ActivityLogService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    /**
     * Batas retry saat nomor transaksi bentrok (unique index) —
     * DATABASE.md Bab 10: generate dalam DB transaction, bentrok → retry.
     */
    private const MAX_INVOICE_RETRY = 5;

    /**
     * Simpan transaksi (PRD 5.3–5.4) — atomic: transaksi + item +
     * pengurangan stok + stock_movement dalam satu DB::transaction()
     * dengan lockForUpdate() pada baris produk (anti race condition).
     */
    public function store(StoreTransactionRequest $request): JsonResponse
    {
        $data = $request->validated();

        // Fase 15 — idempotency sinkronisasi offline (DATABASE.md Bab 10):
        // client_uuid yang sama → kembalikan transaksi yang sudah ada,
        // retry berkali-kali tidak pernah menghasilkan transaksi ganda.
        $clientUuid = $data['client_uuid'] ?? null;

        if ($clientUuid !== null) {
            $existing = Transaction::query()
                ->where('client_uuid', $clientUuid)
                ->first();

            if ($existing !== null) {
                return $this->duplicateResponse($existing);
            }
        }

        // Hanya metode pembayaran aktif yang boleh dipakai (PRD 5.13.C)
        $paymentMethod = PaymentMethod::query()
            ->where('code', $data['payment_method'])
            ->where('is_active', true)
            ->first();

        if ($paymentMethod === null) {
            throw ValidationException::withMessages([
                'payment_method' => 'Metode pembayaran tidak tersedia.',
            ]);
        }

        $attempt = 0;

        do {
            try {
                $transaction = DB::transaction(
                    fn () => $this->createTransaction($request->user()->id, $data),
                );

                break;
            } catch (UniqueConstraintViolationException $e) {
                // Race dua sync bersamaan dgn client_uuid sama: yang
                // kalah menemukan transaksi milik pemenang → idempotent
                if ($clientUuid !== null) {
                    $existing = Transaction::query()
                        ->where('client_uuid', $clientUuid)
                        ->first();

                    if ($existing !== null) {
                        return $this->duplicateResponse($existing);
                    }
                }

                if (++$attempt >= self::MAX_INVOICE_RETRY) {
                    throw $e;
                }
            }
        } while (true);

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_TRANSAKSI,
            'Transaksi',
            "Transaksi {$transaction->invoice_number} (total {$transaction->total})",
        );

        return response()->json([
            'transaction' => $this->receiptPayload($transaction, $paymentMethod->name),
        ], 201);
    }

    /**
     * Business logic inti — dijalankan di dalam DB::transaction().
     * Gagal apa pun (stok kurang, produk tak tersedia) → seluruh
     * transaksi rollback, tidak ada data setengah tersimpan.
     *
     * @param  array<string, mixed>  $data
     */
    private function createTransaction(int $userId, array $data): Transaction
    {
        $settings = Setting::asArray();
        $taxEnabled = ($settings['tax_enabled'] ?? '0') === '1';
        $taxPercent = $taxEnabled ? (float) ($settings['tax_percent'] ?? 0) : 0.0;
        $roundingMethod = $settings['rounding_method'] ?? 'none';

        $subtotal = 0;
        $rows = [];

        foreach ($data['items'] as $item) {
            // Kunci baris produk sampai commit — stok tidak bisa
            // dikurangi transaksi lain di sela validasi (PRD 5.8)
            $product = Product::query()
                ->whereKey($item['product_id'])
                ->lockForUpdate()
                ->firstOrFail();

            if (! $product->isSellable()) {
                throw ValidationException::withMessages([
                    'items' => "Produk {$product->name} sedang tidak tersedia.",
                ]);
            }

            if ($product->track_stock && $item['quantity'] > $product->stock) {
                throw ValidationException::withMessages([
                    'items' => "Stok {$product->name} tidak mencukupi (sisa {$product->stock}).",
                ]);
            }

            $lineSubtotal = $product->price * $item['quantity'];
            $subtotal += $lineSubtotal;

            $rows[] = [
                'product' => $product,
                'quantity' => (int) $item['quantity'],
                'note' => $item['note'] ?? null,
                'subtotal' => $lineSubtotal,
            ];
        }

        // Total = (subtotal − diskon) + pajak, lalu pembulatan (PRD 5.3)
        $discountValue = (float) ($data['discount_value'] ?? 0);
        $discount = match ($data['discount_type'] ?? null) {
            'percent' => (int) round($subtotal * min($discountValue, 100) / 100),
            'nominal' => min((int) $discountValue, $subtotal),
            default => 0,
        };

        $taxAmount = (int) round(($subtotal - $discount) * $taxPercent / 100);
        $totalBeforeRounding = $subtotal - $discount + $taxAmount;
        $rounding = Transaction::calculateRounding($totalBeforeRounding, $roundingMethod);
        $total = $totalBeforeRounding + $rounding;

        // Tunai: uang pelanggan wajib cukup, kembalian otomatis.
        // Non-tunai: paid/change null, field uang disembunyikan di UI.
        $isCash = $data['payment_method'] === 'tunai';
        $paidAmount = $isCash ? (int) $data['paid_amount'] : null;

        if ($isCash && $paidAmount < $total) {
            throw ValidationException::withMessages([
                'paid_amount' => 'Uang pelanggan kurang dari total tagihan.',
            ]);
        }

        $transaction = Transaction::create([
            'user_id' => $userId,
            'client_uuid' => $data['client_uuid'] ?? (string) Str::uuid(),
            'invoice_number' => Transaction::nextInvoiceNumber(),
            'subtotal' => $subtotal,
            'discount' => $discount,
            // Snapshot pajak & pembulatan — transaksi lama tidak berubah
            // saat pengaturan diubah (DATABASE.md §5)
            'tax_name' => $taxEnabled ? ($settings['tax_name'] ?? 'Pajak') : null,
            'tax_percent' => $taxPercent,
            'tax_amount' => $taxAmount,
            'rounding' => $rounding,
            'total' => $total,
            'payment_method' => $data['payment_method'],
            'paid_amount' => $paidAmount,
            'change_amount' => $isCash ? $paidAmount - $total : null,
            'customer_phone' => $data['customer_phone'] ?? null,
            'status' => Transaction::STATUS_PAID,
            'sync_status' => 'synced',
        ]);

        foreach ($rows as $row) {
            /** @var Product $product */
            $product = $row['product'];

            // Snapshot nama/harga/modal (DATABASE.md §3.9)
            $transaction->items()->create([
                'product_id' => $product->id,
                'product_name' => $product->name,
                'price' => $product->price,
                'cost_price' => $product->cost_price,
                'quantity' => $row['quantity'],
                'subtotal' => $row['subtotal'],
                'note' => $row['note'] !== '' ? $row['note'] : null,
            ]);

            if ($product->track_stock) {
                $stockBefore = $product->stock;
                $product->update(['stock' => $stockBefore - $row['quantity']]);

                StockMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $userId,
                    'type' => StockMovement::TYPE_SALE,
                    'reference_type' => Transaction::class,
                    'reference_id' => $transaction->id,
                    'quantity_change' => -$row['quantity'],
                    'stock_before' => $stockBefore,
                    'stock_after' => $product->stock,
                    'reason' => null,
                ]);
            }
        }

        return $transaction;
    }

    /**
     * Respons untuk client_uuid yang sudah pernah tersimpan — 200
     * (bukan 201) + duplicate=true; isi struk sama dengan aslinya,
     * tanpa membuat transaksi, stok, atau movement baru.
     */
    private function duplicateResponse(Transaction $transaction): JsonResponse
    {
        $label = PaymentMethod::query()
            ->where('code', $transaction->payment_method)
            ->value('name') ?? $transaction->payment_method;

        return response()->json([
            'transaction' => $this->receiptPayload($transaction, $label),
            'duplicate' => true,
        ], 200);
    }

    /**
     * Data struk untuk preview & cetak (PRD 5.5) — seluruhnya dari
     * snapshot transaksi, bukan data produk terkini.
     *
     * @return array<string, mixed>
     */
    private function receiptPayload(Transaction $transaction, string $paymentMethodLabel): array
    {
        $transaction->load('items', 'user');

        return [
            'id' => $transaction->id,
            'invoice_number' => $transaction->invoice_number,
            'date' => $transaction->created_at->toIso8601String(),
            'kasir' => $transaction->user->name,
            'items' => $transaction->items->map(fn ($item) => [
                'product_name' => $item->product_name,
                'price' => $item->price,
                'quantity' => $item->quantity,
                'subtotal' => $item->subtotal,
                'note' => $item->note,
            ])->all(),
            'subtotal' => $transaction->subtotal,
            'discount' => $transaction->discount,
            'tax_name' => $transaction->tax_name,
            'tax_percent' => $transaction->tax_percent,
            'tax_amount' => $transaction->tax_amount,
            'rounding' => $transaction->rounding,
            'total' => $transaction->total,
            'payment_method' => $transaction->payment_method,
            'payment_method_label' => $paymentMethodLabel,
            'paid_amount' => $transaction->paid_amount,
            'change_amount' => $transaction->change_amount,
            'customer_phone' => $transaction->customer_phone,
        ];
    }
}
