<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LaporanTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Transaksi lunas + item langsung di DB (tanpa endpoint kasir).
     *
     * @param  list<array{product: Product, quantity: int, price: int, cost_price?: int|null}>  $items
     * @param  array<string, mixed>  $overrides
     */
    private function paidTransaction(User $kasir, array $items, array $overrides = []): Transaction
    {
        $subtotal = collect($items)
            ->sum(fn (array $item) => $item['price'] * $item['quantity']);

        $transaction = Transaction::create(array_merge([
            'user_id' => $kasir->id,
            'client_uuid' => (string) Str::uuid(),
            'invoice_number' => 'TRX-TEST-'.strtoupper(Str::random(10)),
            'subtotal' => $subtotal,
            'discount' => 0,
            'tax_name' => null,
            'tax_percent' => 0,
            'tax_amount' => 0,
            'rounding' => 0,
            'total' => $subtotal,
            'payment_method' => 'tunai',
            'status' => Transaction::STATUS_PAID,
            'sync_status' => 'synced',
        ], $overrides));

        foreach ($items as $item) {
            $transaction->items()->create([
                'product_id' => $item['product']->id,
                'product_name' => $item['product']->name,
                'price' => $item['price'],
                'cost_price' => array_key_exists('cost_price', $item) ? $item['cost_price'] : null,
                'quantity' => $item['quantity'],
                'subtotal' => $item['price'] * $item['quantity'],
            ]);
        }

        // created_at tidak fillable — set eksplisit bila dioverride
        if (isset($overrides['created_at'])) {
            $transaction->forceFill(['created_at' => $overrides['created_at']])->save();
        }

        return $transaction;
    }

    /** @param array<string, mixed> $overrides */
    private function makePurchase(User $user, Supplier $supplier, array $overrides = []): Purchase
    {
        return Purchase::create(array_merge([
            'supplier_id' => $supplier->id,
            'user_id' => $user->id,
            'invoice_number' => 'PUR-TEST-'.strtoupper(Str::random(8)),
            'purchase_date' => now()->toDateString(),
            'subtotal' => 10000,
            'discount' => 0,
            'tax' => 0,
            'total' => 10000,
            'notes' => null,
        ], $overrides));
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/laporan')->assertRedirect('/login');
    }

    public function test_dashboard_renders_for_owner_and_admin(): void
    {
        foreach (['owner', 'admin'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]))
                ->get('/laporan')
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Laporan/Index')
                    ->has('stats')
                    ->has('charts.sales_daily', 30)
                    ->has('charts.top_products')
                    ->has('charts.payment_methods')
                    ->has('charts.category_sales')
                    ->has('analytics'));
        }
    }

    public function test_kasir_is_redirected_from_dashboard_to_sales_report(): void
    {
        $this->actingAs(User::factory()->create()) // kasir
            ->get('/laporan')
            ->assertRedirect(route('laporan.penjualan', absolute: false));
    }

    public function test_dashboard_stats_use_snapshot_cost_and_exclude_cancelled(): void
    {
        $owner = User::factory()->owner()->create();
        $supplier = Supplier::factory()->create();
        // cost_price produk SAAT INI 9999 — laba harus memakai snapshot
        // cost_price item (5000), bukan harga modal terbaru
        $product = Product::factory()->tracked(50)->create(['cost_price' => 9999]);

        // Penjualan hari ini: 2 × 15000 = 30000, HPP snapshot 2 × 5000
        $this->paidTransaction($owner, [
            ['product' => $product, 'quantity' => 2, 'price' => 15000, 'cost_price' => 5000],
        ]);

        // Transaksi cancelled — wajib dikecualikan dari semua angka
        $this->paidTransaction($owner, [
            ['product' => $product, 'quantity' => 1, 'price' => 99000, 'cost_price' => 5000],
        ], ['status' => Transaction::STATUS_CANCELLED]);

        $this->makePurchase($owner, $supplier, ['total' => 12000]);
        Expense::factory()->create(['amount' => 7000]);

        $this->actingAs($owner)
            ->get('/laporan')
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.today_sales', 30000)
                ->where('stats.month_sales', 30000)
                ->where('stats.month_purchases', 12000)
                ->where('stats.month_expenses', 7000)
                ->where('stats.gross_profit', 20000) // 30000 − 10000
                ->where('stats.net_profit', 13000) // 20000 − 7000
                ->where('stats.has_cost_data', true)
                ->where('stats.today_transactions', 1)
                ->where('stats.today_items_sold', 2));
    }

    public function test_dashboard_charts_aggregate_sales_data(): void
    {
        $owner = User::factory()->owner()->create();
        $productA = Product::factory()->tracked(50)->create(['name' => 'Kopi Susu']);
        $productB = Product::factory()->tracked(50)->create(['name' => 'Roti Bakar']);

        $this->paidTransaction($owner, [
            ['product' => $productA, 'quantity' => 5, 'price' => 10000],
        ]);
        $this->paidTransaction($owner, [
            ['product' => $productB, 'quantity' => 2, 'price' => 20000],
        ], ['payment_method' => 'qris']);

        $this->actingAs($owner)
            ->get('/laporan')
            ->assertInertia(fn (Assert $page) => $page
                // Line: titik terakhir = omzet hari ini (50000 + 40000)
                ->where('charts.sales_daily.29.total', 90000)
                // Horizontal bar: produk terlaris by qty
                ->where('charts.top_products.0.name', 'Kopi Susu')
                ->where('charts.top_products.0.quantity', 5)
                ->has('charts.top_products', 2)
                // Pie metode pembayaran
                ->where('charts.payment_methods.0.code', 'tunai')
                ->where('charts.payment_methods.0.total', 50000)
                ->has('charts.payment_methods', 2)
                // Bar kategori produk
                ->has('charts.category_sales', 2));
    }

    public function test_dashboard_analytics_rank_kasir_supplier_and_averages(): void
    {
        $owner = User::factory()->owner()->create();
        $kasirTop = User::factory()->create(['name' => 'Kasir Andal']);
        $product = Product::factory()->tracked(50)->create();
        $supplierTop = Supplier::factory()->create(['name' => 'CV Juara']);
        $supplierLain = Supplier::factory()->create();

        // Kasir Andal: 60000; Owner: 20000 → kasir terbaik = Kasir Andal
        $this->paidTransaction($kasirTop, [
            ['product' => $product, 'quantity' => 4, 'price' => 15000],
        ]);
        $this->paidTransaction($owner, [
            ['product' => $product, 'quantity' => 2, 'price' => 10000],
        ]);

        $this->makePurchase($owner, $supplierTop, ['total' => 50000]);
        $this->makePurchase($owner, $supplierTop, ['total' => 30000]);
        $this->makePurchase($owner, $supplierLain, ['total' => 60000]);

        $this->actingAs($owner)
            ->get('/laporan')
            ->assertInertia(fn (Assert $page) => $page
                ->where('analytics.best_kasir.name', 'Kasir Andal')
                ->where('analytics.best_kasir.total', 60000)
                ->where('analytics.top_supplier.name', 'CV Juara')
                ->where('analytics.top_supplier.total', 80000)
                ->where('analytics.top_product.name', $product->name)
                // (60000 + 20000) / 2 transaksi
                ->where('analytics.avg_transaction_value', 40000)
                // (4 + 2) item / 2 transaksi
                ->where('analytics.avg_items_per_transaction', 3));
    }

    public function test_sales_report_supports_filters_and_search(): void
    {
        $owner = User::factory()->owner()->create();
        $kasir = User::factory()->create();
        $product = Product::factory()->tracked(50)->create();

        $target = $this->paidTransaction($kasir, [
            ['product' => $product, 'quantity' => 1, 'price' => 10000],
        ], ['invoice_number' => 'TRX-TEST-CARIINI']);

        $this->paidTransaction($owner, [
            ['product' => $product, 'quantity' => 1, 'price' => 20000],
        ], ['payment_method' => 'qris', 'status' => Transaction::STATUS_CANCELLED]);

        $old = $this->paidTransaction($owner, [
            ['product' => $product, 'quantity' => 1, 'price' => 5000],
        ], ['created_at' => now()->subDays(10)]);

        $this->actingAs($owner)
            ->get('/laporan/penjualan?search=CARIINI')
            ->assertInertia(fn (Assert $page) => $page
                ->component('Laporan/Penjualan')
                ->has('transactions.data', 1)
                ->where('transactions.data.0.invoice_number', 'TRX-TEST-CARIINI'));

        $this->actingAs($owner)
            ->get("/laporan/penjualan?kasir={$kasir->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 1)
                ->where('transactions.data.0.id', $target->id));

        $this->actingAs($owner)
            ->get('/laporan/penjualan?payment_method=qris')
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 1)
                ->where('transactions.data.0.status', 'cancelled'));

        $this->actingAs($owner)
            ->get('/laporan/penjualan?status=cancelled')
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 1));

        $from = now()->subDays(15)->toDateString();
        $to = now()->subDays(5)->toDateString();

        $this->actingAs($owner)
            ->get("/laporan/penjualan?date_from={$from}&date_to={$to}")
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 1)
                ->where('transactions.data.0.id', $old->id));

        // Ringkasan omzet hanya menghitung transaksi lunas
        $this->actingAs($owner)
            ->get('/laporan/penjualan')
            ->assertInertia(fn (Assert $page) => $page
                ->where('summary.count', 3)
                ->where('summary.total', 15000));
    }

    public function test_reversed_date_range_is_swapped_not_rejected(): void
    {
        $owner = User::factory()->owner()->create();
        $from = now()->subDays(5)->toDateString();
        $to = now()->toDateString();

        // date_from > date_to → server menukar otomatis (rentang valid)
        $this->actingAs($owner)
            ->get("/laporan/penjualan?date_from={$to}&date_to={$from}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.date_from', $from)
                ->where('filters.date_to', $to));
    }

    public function test_sales_report_is_paginated(): void
    {
        $owner = User::factory()->owner()->create();
        $product = Product::factory()->tracked(50)->create();

        for ($i = 0; $i < 12; $i++) {
            $this->paidTransaction($owner, [
                ['product' => $product, 'quantity' => 1, 'price' => 1000],
            ]);
        }

        $this->actingAs($owner)
            ->get('/laporan/penjualan')
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 10)
                ->where('transactions.total', 12));
    }

    public function test_kasir_only_sees_own_sales_even_with_filter_params(): void
    {
        $kasirA = User::factory()->create();
        $kasirB = User::factory()->create();
        $product = Product::factory()->tracked(50)->create();

        $own = $this->paidTransaction($kasirA, [
            ['product' => $product, 'quantity' => 1, 'price' => 10000],
        ]);
        $this->paidTransaction($kasirB, [
            ['product' => $product, 'quantity' => 1, 'price' => 20000],
        ]);

        // Parameter kasir milik orang lain diabaikan — tetap ter-scope
        $this->actingAs($kasirA)
            ->get("/laporan/penjualan?kasir={$kasirB->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 1)
                ->where('transactions.data.0.id', $own->id)
                ->where('can.viewAll', false)
                ->has('kasirs', 0));
    }

    public function test_purchase_expense_and_stock_reports_are_forbidden_for_kasir(): void
    {
        $kasir = User::factory()->create();

        foreach (['pembelian', 'pengeluaran', 'stok'] as $report) {
            $this->actingAs($kasir)->get("/laporan/{$report}")->assertForbidden();
            $this->actingAs($kasir)->get("/laporan/{$report}/export/pdf")->assertForbidden();
            $this->actingAs($kasir)->get("/laporan/{$report}/export/excel")->assertForbidden();
        }
    }

    public function test_purchase_report_filters_by_supplier_and_totals(): void
    {
        $owner = User::factory()->owner()->create();
        $supplierA = Supplier::factory()->create();
        $supplierB = Supplier::factory()->create();

        $target = $this->makePurchase($owner, $supplierA, ['total' => 40000]);
        $this->makePurchase($owner, $supplierB, ['total' => 25000]);

        $this->actingAs($owner)
            ->get("/laporan/pembelian?supplier={$supplierA->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->component('Laporan/Pembelian')
                ->has('purchases.data', 1)
                ->where('purchases.data.0.id', $target->id)
                ->where('summary.total', 40000));

        $this->actingAs($owner)
            ->get('/laporan/pembelian')
            ->assertInertia(fn (Assert $page) => $page
                ->where('summary.count', 2)
                ->where('summary.total', 65000));
    }

    public function test_expense_report_filters_by_category_and_method(): void
    {
        $owner = User::factory()->owner()->create();
        $target = Expense::factory()->create(['amount' => 15000, 'payment_method' => 'qris']);
        Expense::factory()->create(['amount' => 5000]);

        $this->actingAs($owner)
            ->get("/laporan/pengeluaran?category={$target->expense_category_id}")
            ->assertInertia(fn (Assert $page) => $page
                ->component('Laporan/Pengeluaran')
                ->has('expenses.data', 1)
                ->where('expenses.data.0.id', $target->id)
                ->where('summary.total', 15000));

        $this->actingAs($owner)
            ->get('/laporan/pengeluaran?payment_method=qris')
            ->assertInertia(fn (Assert $page) => $page
                ->has('expenses.data', 1)
                ->where('expenses.data.0.id', $target->id));
    }

    public function test_stock_report_computes_inventory_value(): void
    {
        $owner = User::factory()->owner()->create();
        $withCost = Product::factory()->tracked(10)->create(['cost_price' => 2000]);
        // cost_price null → nilai persediaan dihitung 0
        Product::factory()->tracked(5)->create(['cost_price' => null]);

        $this->actingAs($owner)
            ->get('/laporan/stok')
            ->assertInertia(fn (Assert $page) => $page
                ->component('Laporan/Stok')
                ->has('products.data', 2)
                ->where('summary.total_value', 20000));

        $this->actingAs($owner)
            ->get('/laporan/stok?search='.urlencode($withCost->name))
            ->assertInertia(fn (Assert $page) => $page
                ->has('products.data', 1)
                ->where('products.data.0.stock_value', 20000));
    }

    public function test_all_reports_export_pdf_and_excel_even_without_data(): void
    {
        $owner = User::factory()->owner()->create();

        foreach (['penjualan', 'pembelian', 'pengeluaran', 'stok'] as $report) {
            $pdf = $this->actingAs($owner)->get("/laporan/{$report}/export/pdf");
            $pdf->assertOk();
            $this->assertStringContainsString(
                'application/pdf',
                (string) $pdf->headers->get('content-type'),
                "Export PDF laporan {$report}",
            );

            $this->actingAs($owner)
                ->get("/laporan/{$report}/export/excel")
                ->assertOk()
                ->assertDownload();
        }
    }

    public function test_kasir_can_export_own_sales_report(): void
    {
        $kasir = User::factory()->create();
        $product = Product::factory()->tracked(50)->create();
        $this->paidTransaction($kasir, [
            ['product' => $product, 'quantity' => 1, 'price' => 10000],
        ]);

        $this->actingAs($kasir)
            ->get('/laporan/penjualan/export/pdf')
            ->assertOk();

        $this->actingAs($kasir)
            ->get('/laporan/penjualan/export/excel')
            ->assertOk()
            ->assertDownload();
    }

    public function test_invalid_export_format_returns_404(): void
    {
        $owner = User::factory()->owner()->create();

        $this->actingAs($owner)
            ->get('/laporan/penjualan/export/csv')
            ->assertNotFound();
    }
}
