<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Setting;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\User;
use Database\Seeders\PaymentMethodSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TransactionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PaymentMethodSeeder::class);
    }

    public function test_cash_transaction_is_stored_with_snapshot_and_change(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create([
            'name' => 'Es Kopi Susu',
            'price' => 18000,
            'cost_price' => 9000,
        ]);

        $response = $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2, 'note' => 'es sedikit'],
            ],
            'payment_method' => 'tunai',
            'paid_amount' => 50000,
        ]);

        $response->assertCreated()
            ->assertJsonPath('transaction.subtotal', 36000)
            ->assertJsonPath('transaction.total', 36000)
            ->assertJsonPath('transaction.paid_amount', 50000)
            ->assertJsonPath('transaction.change_amount', 14000)
            ->assertJsonPath('transaction.kasir', $kasir->name);

        $this->assertDatabaseHas('transactions', [
            'user_id' => $kasir->id,
            'subtotal' => 36000,
            'discount' => 0,
            'total' => 36000,
            'payment_method' => 'tunai',
            'paid_amount' => 50000,
            'change_amount' => 14000,
            'status' => 'paid',
        ]);

        // Snapshot nama/harga/modal di transaction_items (DATABASE.md §5)
        $this->assertDatabaseHas('transaction_items', [
            'product_id' => $product->id,
            'product_name' => 'Es Kopi Susu',
            'price' => 18000,
            'cost_price' => 9000,
            'quantity' => 2,
            'subtotal' => 36000,
            'note' => 'es sedikit',
        ]);
    }

    public function test_invoice_number_follows_daily_format_and_sequence(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['price' => 10000]);

        $first = $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'qris',
        ]);

        $second = $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'qris',
        ]);

        $prefix = 'TRX-'.now()->format('Ymd').'-';

        $first->assertJsonPath('transaction.invoice_number', $prefix.'0001');
        $second->assertJsonPath('transaction.invoice_number', $prefix.'0002');
    }

    public function test_stock_is_decremented_and_movement_recorded(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->tracked(10)->create();

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 3]],
            'payment_method' => 'qris',
        ])->assertCreated();

        $this->assertSame(7, $product->fresh()->stock);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'user_id' => $kasir->id,
            'type' => 'sale',
            'reference_type' => Transaction::class,
            'quantity_change' => -3,
            'stock_before' => 10,
            'stock_after' => 7,
        ]);
    }

    public function test_untracked_product_does_not_create_stock_movement(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['track_stock' => false]);

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'payment_method' => 'qris',
        ])->assertCreated();

        $this->assertSame(0, StockMovement::query()->count());
    }

    public function test_cash_payment_less_than_total_is_rejected(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['price' => 20000]);

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'tunai',
            'paid_amount' => 15000,
        ])->assertUnprocessable()->assertJsonValidationErrors('paid_amount');

        $this->assertSame(0, Transaction::query()->count());
    }

    public function test_non_cash_transaction_has_no_paid_and_change_amount(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['price' => 25000]);

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'qris',
        ])->assertCreated();

        $this->assertDatabaseHas('transactions', [
            'payment_method' => 'qris',
            'paid_amount' => null,
            'change_amount' => null,
            'total' => 25000,
        ]);
    }

    public function test_inactive_payment_method_is_rejected(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create();

        // Kartu default nonaktif (DATABASE.md §8)
        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'kartu',
        ])->assertUnprocessable()->assertJsonValidationErrors('payment_method');
    }

    public function test_insufficient_stock_rolls_back_whole_transaction(): void
    {
        $kasir = User::factory()->create();
        $available = Product::factory()->tracked(10)->create();
        $lowStock = Product::factory()->tracked(1)->create();

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [
                ['product_id' => $available->id, 'quantity' => 2],
                ['product_id' => $lowStock->id, 'quantity' => 5],
            ],
            'payment_method' => 'qris',
        ])->assertUnprocessable()->assertJsonValidationErrors('items');

        // Rollback total — tidak ada data setengah tersimpan
        $this->assertSame(0, Transaction::query()->count());
        $this->assertSame(0, StockMovement::query()->count());
        $this->assertSame(10, $available->fresh()->stock);
        $this->assertSame(1, $lowStock->fresh()->stock);
    }

    public function test_unsellable_product_is_rejected(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->habis()->create();

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'qris',
        ])->assertUnprocessable()->assertJsonValidationErrors('items');
    }

    public function test_discount_is_applied_before_total(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create(['price' => 20000]);

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'discount_type' => 'percent',
            'discount_value' => 10,
            'payment_method' => 'tunai',
            'paid_amount' => 36000,
        ])->assertCreated()
            ->assertJsonPath('transaction.discount', 4000)
            ->assertJsonPath('transaction.total', 36000)
            ->assertJsonPath('transaction.change_amount', 0);
    }

    public function test_tax_snapshot_is_stored_when_tax_enabled(): void
    {
        Setting::setValue('tax_enabled', '1');
        Setting::setValue('tax_name', 'PPN');
        Setting::setValue('tax_percent', '10');

        $kasir = User::factory()->create();
        $product = Product::factory()->create(['price' => 10000]);

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'tunai',
            'paid_amount' => 11000,
        ])->assertCreated();

        $this->assertDatabaseHas('transactions', [
            'tax_name' => 'PPN',
            'tax_percent' => 10.00,
            'tax_amount' => 1000,
            'total' => 11000,
        ]);
    }

    public function test_tax_is_not_applied_when_disabled(): void
    {
        Setting::setValue('tax_enabled', '0');
        Setting::setValue('tax_percent', '10');

        $kasir = User::factory()->create();
        $product = Product::factory()->create(['price' => 10000]);

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'qris',
        ])->assertCreated();

        $this->assertDatabaseHas('transactions', [
            'tax_name' => null,
            'tax_amount' => 0,
            'total' => 10000,
        ]);
    }

    public function test_rounding_is_applied_and_stored(): void
    {
        Setting::setValue('rounding_method', 'up_500');

        $kasir = User::factory()->create();
        $product = Product::factory()->create(['price' => 10300]);

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'qris',
        ])->assertCreated()
            ->assertJsonPath('transaction.rounding', 200)
            ->assertJsonPath('transaction.total', 10500);

        $this->assertDatabaseHas('transactions', [
            'rounding' => 200,
            'total' => 10500,
        ]);
    }

    public function test_customer_phone_is_stored_when_provided(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create();

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'qris',
            'customer_phone' => '081234567890',
        ])->assertCreated();

        $this->assertDatabaseHas('transactions', [
            'customer_phone' => '081234567890',
        ]);
    }

    public function test_cash_requires_paid_amount(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->create();

        $this->actingAs($kasir)->postJson('/kasir/bayar', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'tunai',
        ])->assertUnprocessable()->assertJsonValidationErrors('paid_amount');
    }

    public function test_guest_cannot_store_transaction(): void
    {
        $this->postJson('/kasir/bayar', [])->assertUnauthorized();
    }
}
