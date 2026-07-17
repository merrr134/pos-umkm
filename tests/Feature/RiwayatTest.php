<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\User;
use Database\Seeders\PaymentMethodSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RiwayatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PaymentMethodSeeder::class);
    }

    /**
     * Buat transaksi langsung di DB — untuk skenario list/filter yang
     * tidak butuh alur pembayaran penuh.
     *
     * @param  array<string, mixed>  $overrides
     */
    private function makeTransaction(User $kasir, array $overrides = [], ?Carbon $createdAt = null): Transaction
    {
        $transaction = Transaction::create(array_merge([
            'user_id' => $kasir->id,
            'client_uuid' => (string) Str::uuid(),
            'invoice_number' => 'TRX-TEST-'.strtoupper(Str::random(8)),
            'subtotal' => 10000,
            'discount' => 0,
            'tax_percent' => 0,
            'tax_amount' => 0,
            'rounding' => 0,
            'total' => 10000,
            'payment_method' => 'tunai',
            'paid_amount' => 10000,
            'change_amount' => 0,
            'status' => Transaction::STATUS_PAID,
            'sync_status' => 'synced',
        ], $overrides));

        if ($createdAt !== null) {
            $transaction->forceFill(['created_at' => $createdAt])->save();
        }

        return $transaction;
    }

    /** Transaksi lewat alur pembayaran asli — untuk skenario stok. */
    private function payTransaction(User $kasir, Product $product, int $quantity): Transaction
    {
        $response = $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => $quantity]],
            'payment_method' => 'qris',
        ]);

        $response->assertCreated();

        return Transaction::findOrFail($response->json('transaction.id'));
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/riwayat')->assertRedirect('/login');
    }

    public function test_riwayat_page_renders_for_all_roles(): void
    {
        foreach (['owner', 'admin', 'kasir'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)
                ->get('/riwayat')
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Riwayat/Index')
                    ->has('transactions')
                    ->has('filters')
                    ->has('paymentMethods')
                    ->has('receiptProfile'));
        }
    }

    public function test_default_shows_only_todays_transactions(): void
    {
        $kasir = User::factory()->create();
        $this->makeTransaction($kasir, [], now()->subDay());
        $today = $this->makeTransaction($kasir);

        $this->actingAs($kasir)
            ->get('/riwayat')
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 1)
                ->where('transactions.data.0.invoice_number', $today->invoice_number));
    }

    public function test_date_filter_can_include_older_transactions(): void
    {
        $kasir = User::factory()->create();
        $this->makeTransaction($kasir, [], now()->subDay());
        $this->makeTransaction($kasir);

        $from = now()->subDays(2)->toDateString();
        $to = now()->toDateString();

        $this->actingAs($kasir)
            ->get("/riwayat?date_from={$from}&date_to={$to}")
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 2));
    }

    public function test_kasir_only_sees_own_transactions(): void
    {
        $kasirA = User::factory()->create();
        $kasirB = User::factory()->create();
        $own = $this->makeTransaction($kasirA);
        $this->makeTransaction($kasirB);

        $this->actingAs($kasirA)
            ->get('/riwayat')
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 1)
                ->where('transactions.data.0.invoice_number', $own->invoice_number)
                // Dropdown filter kasir tidak tersedia untuk role kasir
                ->has('kasirs', 0));
    }

    public function test_admin_and_owner_see_all_transactions(): void
    {
        $kasirA = User::factory()->create();
        $kasirB = User::factory()->create();
        $this->makeTransaction($kasirA);
        $this->makeTransaction($kasirB);

        foreach ([User::factory()->admin()->create(), User::factory()->owner()->create()] as $user) {
            $this->actingAs($user)
                ->get('/riwayat')
                ->assertInertia(fn (Assert $page) => $page
                    ->has('transactions.data', 2));
        }
    }

    public function test_kasir_param_is_ignored_for_kasir_role(): void
    {
        $kasirA = User::factory()->create();
        $kasirB = User::factory()->create();
        $this->makeTransaction($kasirA);
        $other = $this->makeTransaction($kasirB);

        $this->actingAs($kasirA)
            ->get("/riwayat?kasir={$kasirB->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 1)
                ->where('transactions.data.0.id', fn ($id) => $id !== $other->id));
    }

    public function test_filters_by_status_method_and_kasir(): void
    {
        $owner = User::factory()->owner()->create();
        $kasirA = User::factory()->create();
        $kasirB = User::factory()->create();

        $cancelled = $this->makeTransaction($kasirA, [
            'status' => Transaction::STATUS_CANCELLED,
            'payment_method' => 'qris',
            'paid_amount' => null,
            'change_amount' => null,
        ]);
        $paidTunai = $this->makeTransaction($kasirB);

        $this->actingAs($owner)
            ->get('/riwayat?status=cancelled')
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 1)
                ->where('transactions.data.0.invoice_number', $cancelled->invoice_number));

        $this->actingAs($owner)
            ->get('/riwayat?payment_method=tunai')
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 1)
                ->where('transactions.data.0.invoice_number', $paidTunai->invoice_number));

        $this->actingAs($owner)
            ->get("/riwayat?kasir={$kasirA->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 1)
                ->where('transactions.data.0.invoice_number', $cancelled->invoice_number));
    }

    public function test_search_filters_by_invoice_number(): void
    {
        $kasir = User::factory()->create();
        $target = $this->makeTransaction($kasir, ['invoice_number' => 'TRX-TEST-CARIINI']);
        $this->makeTransaction($kasir, ['invoice_number' => 'TRX-TEST-LAINNYA']);

        $this->actingAs($kasir)
            ->get('/riwayat?search=CARIINI')
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 1)
                ->where('transactions.data.0.invoice_number', $target->invoice_number));
    }

    public function test_detail_returns_snapshot_not_current_product_data(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['name' => 'Es Kopi Susu', 'price' => 18000]);
        $transaction = $this->payTransaction($kasir, $product, 2);

        // Ubah master produk — detail harus tetap dari snapshot
        $product->update(['name' => 'Nama Baru', 'price' => 99000]);

        $this->actingAs($kasir)
            ->getJson("/riwayat/{$transaction->id}")
            ->assertOk()
            ->assertJsonPath('transaction.invoice_number', $transaction->invoice_number)
            ->assertJsonPath('transaction.kasir', $kasir->name)
            ->assertJsonPath('transaction.items.0.product_name', 'Es Kopi Susu')
            ->assertJsonPath('transaction.items.0.price', 18000)
            ->assertJsonPath('transaction.items.0.quantity', 2)
            ->assertJsonPath('transaction.subtotal', 36000)
            ->assertJsonPath('transaction.status', 'paid')
            ->assertJsonPath('transaction.payment_method', 'qris');
    }

    public function test_kasir_cannot_view_others_transaction_detail(): void
    {
        $kasirA = User::factory()->create();
        $kasirB = User::factory()->create();
        $transaction = $this->makeTransaction($kasirB);

        $this->actingAs($kasirA)
            ->getJson("/riwayat/{$transaction->id}")
            ->assertForbidden();
    }

    public function test_admin_can_view_any_transaction_detail(): void
    {
        $kasir = User::factory()->create();
        $transaction = $this->makeTransaction($kasir);

        $this->actingAs(User::factory()->admin()->create())
            ->getJson("/riwayat/{$transaction->id}")
            ->assertOk();
    }

    public function test_owner_can_cancel_transaction_and_stock_is_restored(): void
    {
        $owner = User::factory()->owner()->create();
        $kasir = User::factory()->create();
        $product = Product::factory()->tracked(10)->create();
        $transaction = $this->payTransaction($kasir, $product, 3);

        $this->assertSame(7, $product->fresh()->stock);

        $this->actingAs($owner)
            ->post("/riwayat/{$transaction->id}/batal", [
                'cancel_reason' => 'Salah input pesanan',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $transaction->refresh();

        $this->assertSame(Transaction::STATUS_CANCELLED, $transaction->status);
        $this->assertSame('Salah input pesanan', $transaction->cancel_reason);
        $this->assertSame($owner->id, $transaction->cancelled_by);
        $this->assertNotNull($transaction->cancelled_at);

        // Stok kembali sesuai qty transaksi (PRD 5.8)
        $this->assertSame(10, $product->fresh()->stock);

        // Stock movement adjustment tercatat (PRD 5.4)
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'user_id' => $owner->id,
            'type' => StockMovement::TYPE_ADJUSTMENT,
            'reference_type' => Transaction::class,
            'reference_id' => $transaction->id,
            'quantity_change' => 3,
            'stock_before' => 7,
            'stock_after' => 10,
            'reason' => 'Pembatalan transaksi '.$transaction->invoice_number,
        ]);
    }

    public function test_cancel_requires_reason(): void
    {
        $owner = User::factory()->owner()->create();
        $transaction = $this->makeTransaction($owner);

        $this->actingAs($owner)
            ->from('/riwayat')
            ->post("/riwayat/{$transaction->id}/batal", ['cancel_reason' => ''])
            ->assertRedirect('/riwayat')
            ->assertSessionHasErrors('cancel_reason');

        $this->assertSame(Transaction::STATUS_PAID, $transaction->fresh()->status);
    }

    public function test_admin_and_kasir_cannot_cancel_transaction(): void
    {
        $kasir = User::factory()->create();
        $transaction = $this->makeTransaction($kasir);

        foreach ([User::factory()->admin()->create(), $kasir] as $user) {
            $this->actingAs($user)
                ->post("/riwayat/{$transaction->id}/batal", [
                    'cancel_reason' => 'Coba batalkan',
                ])
                ->assertForbidden();
        }

        $this->assertSame(Transaction::STATUS_PAID, $transaction->fresh()->status);
    }

    public function test_cancelled_transaction_cannot_be_cancelled_again(): void
    {
        $owner = User::factory()->owner()->create();
        $kasir = User::factory()->create();
        $product = Product::factory()->tracked(10)->create();
        $transaction = $this->payTransaction($kasir, $product, 3);

        $this->actingAs($owner)->post("/riwayat/{$transaction->id}/batal", [
            'cancel_reason' => 'Pembatalan pertama',
        ]);

        $this->actingAs($owner)
            ->from('/riwayat')
            ->post("/riwayat/{$transaction->id}/batal", [
                'cancel_reason' => 'Pembatalan kedua',
            ])
            ->assertRedirect('/riwayat')
            ->assertSessionHasErrors('cancel_reason');

        $transaction->refresh();

        // Data pembatalan pertama tidak berubah, stok tidak dobel kembali
        $this->assertSame('Pembatalan pertama', $transaction->cancel_reason);
        $this->assertSame(10, $product->fresh()->stock);
        $this->assertSame(1, StockMovement::query()
            ->where('type', StockMovement::TYPE_ADJUSTMENT)
            ->count());
    }

    public function test_cancel_untracked_product_does_not_touch_stock(): void
    {
        $owner = User::factory()->owner()->create();
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['track_stock' => false, 'stock' => 0]);
        $transaction = $this->payTransaction($kasir, $product, 2);

        $this->actingAs($owner)
            ->post("/riwayat/{$transaction->id}/batal", [
                'cancel_reason' => 'Salah pesanan',
            ])
            ->assertRedirect();

        $this->assertSame(Transaction::STATUS_CANCELLED, $transaction->fresh()->status);
        $this->assertSame(0, $product->fresh()->stock);
        $this->assertSame(0, StockMovement::query()->count());
    }

    public function test_transaction_cannot_be_edited_or_deleted(): void
    {
        $owner = User::factory()->owner()->create();
        $transaction = $this->makeTransaction($owner);

        // Immutable (PRD 5.4) — tidak ada route edit/hapus
        $this->actingAs($owner)
            ->put("/riwayat/{$transaction->id}", [])
            ->assertMethodNotAllowed();

        $this->actingAs($owner)
            ->delete("/riwayat/{$transaction->id}")
            ->assertMethodNotAllowed();
    }
}
