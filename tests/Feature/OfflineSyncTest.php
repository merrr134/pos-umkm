<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use Database\Seeders\PaymentMethodSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Fase 15 — Sinkronisasi transaksi offline (PRD 5.14, DATABASE.md Bab 10).
 *
 * Fokus pada kontrak server: deduplication client_uuid (idempotent),
 * server sebagai sumber kebenaran stok, dan integritas data saat
 * sebuah sinkronisasi ditolak.
 */
class OfflineSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PaymentMethodSeeder::class);
    }

    public function test_client_uuid_is_persisted_from_client(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['price' => 10000]);
        $uuid = (string) Str::uuid();

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'client_uuid' => $uuid,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'qris',
        ])->assertCreated();

        $this->assertDatabaseHas('transactions', ['client_uuid' => $uuid]);
    }

    public function test_duplicate_client_uuid_is_deduplicated(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create([
            'price' => 10000,
            'track_stock' => true,
            'stock' => 10,
        ]);
        $uuid = (string) Str::uuid();

        $payload = [
            'client_uuid' => $uuid,
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'payment_method' => 'tunai',
            'paid_amount' => 20000,
        ];

        $first = $this->actingAs($kasir)->postJson('/kasir/bayar', $payload);
        $first->assertCreated();
        $invoice = $first->json('transaction.invoice_number');

        // Retry berkali-kali dgn client_uuid sama
        for ($i = 0; $i < 3; $i++) {
            $retry = $this->actingAs($kasir)->postJson('/kasir/bayar', $payload);
            $retry->assertOk()
                ->assertJsonPath('duplicate', true)
                ->assertJsonPath('transaction.invoice_number', $invoice);
        }

        // Tepat SATU transaksi tercatat — tidak dobel
        $this->assertSame(
            1,
            Transaction::query()->where('client_uuid', $uuid)->count(),
        );

        // Stok hanya berkurang sekali (10 - 2 = 8), bukan per retry
        $this->assertSame(8, $product->fresh()->stock);
    }

    public function test_different_client_uuid_creates_separate_transactions(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create([
            'price' => 5000,
            'track_stock' => true,
            'stock' => 10,
        ]);

        foreach ([Str::uuid(), Str::uuid()] as $uuid) {
            $this->actingAs($kasir)->postJson('/kasir/bayar', [
                'client_uuid' => (string) $uuid,
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
                'payment_method' => 'qris',
            ])->assertCreated();
        }

        $this->assertSame(2, Transaction::query()->count());
        $this->assertSame(8, $product->fresh()->stock);
    }

    public function test_stock_conflict_is_rejected_and_data_stays_intact(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create([
            'price' => 10000,
            'track_stock' => true,
            'stock' => 5,
        ]);

        // Transaksi lain yang sudah sah (harus tetap utuh)
        $safeUuid = (string) Str::uuid();
        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'client_uuid' => $safeUuid,
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'payment_method' => 'qris',
        ])->assertCreated();

        // Sisa stok 3; transaksi offline minta 10 → konflik stok
        $conflictUuid = (string) Str::uuid();
        $response = $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'client_uuid' => $conflictUuid,
            'items' => [['product_id' => $product->id, 'quantity' => 10]],
            'payment_method' => 'qris',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('items');

        // Transaksi konflik TIDAK tercatat; stok tidak berubah; transaksi
        // lain tetap ada (data tidak rusak — PRD 5.14 poin 7)
        $this->assertDatabaseMissing('transactions', [
            'client_uuid' => $conflictUuid,
        ]);
        $this->assertSame(3, $product->fresh()->stock);
        $this->assertDatabaseHas('transactions', ['client_uuid' => $safeUuid]);
    }

    public function test_rejected_sync_does_not_reserve_invoice_permanently(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create([
            'price' => 10000,
            'track_stock' => true,
            'stock' => 1,
        ]);

        // Gagal karena stok
        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'client_uuid' => (string) Str::uuid(),
            'items' => [['product_id' => $product->id, 'quantity' => 5]],
            'payment_method' => 'qris',
        ])->assertStatus(422);

        // Transaksi valid berikutnya tetap bisa disimpan
        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'client_uuid' => (string) Str::uuid(),
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'qris',
        ])->assertCreated();

        $this->assertSame(1, Transaction::query()->count());
    }
}
