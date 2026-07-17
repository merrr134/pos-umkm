<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use Database\Seeders\PaymentMethodSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fase 14 — Printer Bluetooth (PRD Bab 9).
 *
 * Proses cetak (Bluetooth maupun browser) murni berjalan di client
 * SETELAH transaksi tersimpan; server tidak punya ketergantungan apa
 * pun pada printer. Test ini mengunci kontrak tersebut: transaksi
 * selalu utuh di database dan struk selalu bisa diambil ulang dari
 * Riwayat untuk dicetak kembali — apa pun yang terjadi pada printer.
 */
class PrinterFallbackTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PaymentMethodSeeder::class);
    }

    public function test_transaction_is_stored_without_any_printer_dependency(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['price' => 15000]);

        // Simpan transaksi — request tidak membawa info printer sama
        // sekali; keberhasilan tidak mungkin dipengaruhi status printer.
        $response = $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'tunai',
            'paid_amount' => 20000,
        ]);

        $response->assertCreated();

        $this->assertDatabaseHas('transactions', [
            'user_id' => $kasir->id,
            'total' => 15000,
            'status' => 'paid',
        ]);
    }

    public function test_receipt_can_be_refetched_from_riwayat_for_reprint(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['name' => 'Kopi Tubruk', 'price' => 12000]);

        $created = $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'payment_method' => 'qris',
        ]);

        $created->assertCreated();
        $transaction = Transaction::query()->latest('id')->firstOrFail();

        // Gagal cetak di client → struk diambil ulang dari Riwayat
        // (PRD Bab 9: "struk bisa dicetak ulang dari Riwayat").
        $detail = $this->actingAs($kasir)->getJson('/riwayat/' . $transaction->id);

        $detail->assertOk()
            ->assertJsonPath('transaction.invoice_number', $transaction->invoice_number)
            ->assertJsonPath('transaction.items.0.product_name', 'Kopi Tubruk');
    }
}
