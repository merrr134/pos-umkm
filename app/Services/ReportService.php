<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Transaction;
use App\Models\TransactionItem;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Seluruh query Laporan & Dashboard Analytics (Fase 10) terpusat di
 * sini — controller hanya memanggil service. Semua agregat penjualan
 * mengecualikan transaksi cancelled (PRD 5.4/5.12) dan laba memakai
 * cost_price SNAPSHOT di transaction_items, bukan harga modal terbaru
 * (DATABASE.md §5). Grafik & analytics memakai jendela 30 hari
 * terakhir; kartu statistik memakai hari ini / bulan berjalan.
 */
class ReportService
{
    /**
     * Kartu statistik dashboard.
     *
     * Rumus (PRD 5.12):
     *   Laba Kotor  = Omzet − Σ(cost_price snapshot × qty terjual)
     *   Laba Bersih = Laba Kotor − Total Pengeluaran Operasional
     * Pembelian stok TIDAK dikurangkan lagi (sudah terwakili HPP —
     * mencegah double-counting).
     *
     * @return array<string, mixed>
     */
    public function dashboardStats(): array
    {
        $today = now()->toDateString();
        $monthStart = now()->startOfMonth();
        $monthEnd = now()->endOfMonth();

        $paidThisMonth = Transaction::query()
            ->where('status', Transaction::STATUS_PAID)
            ->whereBetween('created_at', [$monthStart, $monthEnd]);

        $monthSales = (int) (clone $paidThisMonth)->sum('total');

        $itemsThisMonth = TransactionItem::query()
            ->whereHas('transaction', fn (Builder $query) => $query
                ->where('status', Transaction::STATUS_PAID)
                ->whereBetween('created_at', [$monthStart, $monthEnd]));

        // HPP dari snapshot cost_price saat transaksi (bukan cost terbaru)
        $costOfGoodsSold = (int) (clone $itemsThisMonth)
            ->sum(DB::raw('COALESCE(cost_price, 0) * quantity'));

        // PRD Bab 17: belum ada data harga modal → laba tampil "N/A"
        $hasCostData = (clone $itemsThisMonth)
            ->whereNotNull('cost_price')
            ->exists();

        $monthExpenses = (int) Expense::query()
            ->whereBetween('expense_date', [
                $monthStart->toDateString(),
                $monthEnd->toDateString(),
            ])
            ->sum('amount');

        $grossProfit = $monthSales - $costOfGoodsSold;

        return [
            'today_sales' => (int) Transaction::query()
                ->where('status', Transaction::STATUS_PAID)
                ->whereDate('created_at', $today)
                ->sum('total'),
            'month_sales' => $monthSales,
            'month_purchases' => (int) Purchase::query()
                ->whereBetween('purchase_date', [
                    $monthStart->toDateString(),
                    $monthEnd->toDateString(),
                ])
                ->sum('total'),
            'month_expenses' => $monthExpenses,
            'gross_profit' => $grossProfit,
            'net_profit' => $grossProfit - $monthExpenses,
            'has_cost_data' => $hasCostData,
            'today_transactions' => Transaction::query()
                ->where('status', Transaction::STATUS_PAID)
                ->whereDate('created_at', $today)
                ->count(),
            'today_items_sold' => (int) TransactionItem::query()
                ->whereHas('transaction', fn (Builder $query) => $query
                    ->where('status', Transaction::STATUS_PAID)
                    ->whereDate('created_at', $today))
                ->sum('quantity'),
        ];
    }

    /**
     * Grafik line: omzet per hari, 30 hari terakhir (termasuk hari
     * ini). Hari tanpa transaksi diisi 0 agar sumbu X kontinu.
     *
     * @return list<array{date: string, total: int}>
     */
    public function salesLast30Days(): array
    {
        $start = now()->subDays(29)->startOfDay();

        $totals = Transaction::query()
            ->where('status', Transaction::STATUS_PAID)
            ->where('created_at', '>=', $start)
            ->groupBy('date')
            ->orderBy('date')
            ->get([
                DB::raw('DATE(created_at) as date'),
                DB::raw('SUM(total) as total'),
            ])
            ->pluck('total', 'date');

        $series = [];

        for ($i = 0; $i < 30; $i++) {
            $date = $start->clone()->addDays($i)->toDateString();
            $series[] = ['date' => $date, 'total' => (int) ($totals[$date] ?? 0)];
        }

        return $series;
    }

    /**
     * Top produk terlaris 30 hari terakhir (by qty) — nama memakai
     * snapshot product_name agar produk terhapus tetap terhitung.
     *
     * @return list<array{name: string, quantity: int, total: int}>
     */
    public function topProducts(int $limit = 10): array
    {
        return $this->paidItemsLast30Days()
            ->groupBy('product_name')
            ->orderByDesc(DB::raw('SUM(quantity)'))
            ->limit($limit)
            ->get([
                'product_name as name',
                DB::raw('SUM(quantity) as quantity'),
                DB::raw('SUM(subtotal) as total'),
            ])
            ->map(fn ($row) => [
                'name' => $row->name,
                'quantity' => (int) $row->quantity,
                'total' => (int) $row->total,
            ])
            ->all();
    }

    /**
     * Grafik pie: omzet per metode pembayaran, 30 hari terakhir.
     *
     * @return list<array{code: string, count: int, total: int}>
     */
    public function paymentMethodBreakdown(): array
    {
        return Transaction::query()
            ->where('status', Transaction::STATUS_PAID)
            ->where('created_at', '>=', now()->subDays(29)->startOfDay())
            ->groupBy('payment_method')
            ->orderByDesc(DB::raw('SUM(total)'))
            ->get([
                'payment_method as code',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(total) as total'),
            ])
            ->map(fn ($row) => [
                'code' => $row->code,
                'count' => (int) $row->count,
                'total' => (int) $row->total,
            ])
            ->all();
    }

    /**
     * Grafik bar: omzet per kategori produk, 30 hari terakhir.
     * Join ke products (withTrashed via join biasa) → categories;
     * produk yang terlanjur dihapus tetap masuk lewat kategori-nya.
     *
     * @return list<array{name: string, quantity: int, total: int}>
     */
    public function categorySales(): array
    {
        return $this->paidItemsLast30Days()
            ->join('products', 'products.id', '=', 'transaction_items.product_id')
            ->join('categories', 'categories.id', '=', 'products.category_id')
            ->groupBy('categories.name')
            ->orderByDesc(DB::raw('SUM(transaction_items.subtotal)'))
            ->get([
                'categories.name as name',
                DB::raw('SUM(transaction_items.quantity) as quantity'),
                DB::raw('SUM(transaction_items.subtotal) as total'),
            ])
            ->map(fn ($row) => [
                'name' => $row->name,
                'quantity' => (int) $row->quantity,
                'total' => (int) $row->total,
            ])
            ->all();
    }

    /**
     * Analytics dashboard — seluruhnya jendela 30 hari terakhir.
     *
     * @return array<string, mixed>
     */
    public function analytics(): array
    {
        $since = now()->subDays(29)->startOfDay();

        // Kolom diprefix nama tabel — builder ini di-join ke users
        $paid = Transaction::query()
            ->where('transactions.status', Transaction::STATUS_PAID)
            ->where('transactions.created_at', '>=', $since);

        $transactionCount = (clone $paid)->count();
        $itemsSold = (int) $this->paidItemsLast30Days()->sum('quantity');

        $bestKasir = (clone $paid)
            ->join('users', 'users.id', '=', 'transactions.user_id')
            ->groupBy('users.name')
            ->orderByDesc(DB::raw('SUM(transactions.total)'))
            ->first([
                'users.name as name',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(transactions.total) as total'),
            ]);

        $topSupplier = Purchase::query()
            ->where('purchase_date', '>=', $since->toDateString())
            ->join('suppliers', 'suppliers.id', '=', 'purchases.supplier_id')
            ->groupBy('suppliers.name')
            ->orderByDesc(DB::raw('SUM(purchases.total)'))
            ->first([
                'suppliers.name as name',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(purchases.total) as total'),
            ]);

        $topProduct = $this->topProducts(1)[0] ?? null;
        $topCategory = $this->categorySales()[0] ?? null;

        return [
            'top_product' => $topProduct,
            'best_kasir' => $bestKasir !== null ? [
                'name' => $bestKasir->name,
                'count' => (int) $bestKasir->count,
                'total' => (int) $bestKasir->total,
            ] : null,
            'top_supplier' => $topSupplier !== null ? [
                'name' => $topSupplier->name,
                'count' => (int) $topSupplier->count,
                'total' => (int) $topSupplier->total,
            ] : null,
            'top_category' => $topCategory,
            'avg_transaction_value' => $transactionCount > 0
                ? (int) round((clone $paid)->sum('total') / $transactionCount)
                : 0,
            'avg_items_per_transaction' => $transactionCount > 0
                ? round($itemsSold / $transactionCount, 1)
                : 0,
        ];
    }

    /**
     * Laporan Penjualan — query dasar untuk halaman & export.
     * $kasirId ≠ null memaksa scope ke kasir tsb (role kasir hanya
     * boleh melihat transaksinya sendiri).
     *
     * @param  array{search?: string, kasir?: int|string|null, payment_method?: string|null, status?: string|null, date_from?: CarbonImmutable|null, date_to?: CarbonImmutable|null}  $filters
     * @return Builder<Transaction>
     */
    public function salesReportQuery(array $filters, ?int $kasirId = null): Builder
    {
        $search = trim((string) ($filters['search'] ?? ''));

        return Transaction::query()
            ->with(['user' => fn ($query) => $query->withTrashed()->select('id', 'name')])
            ->withCount('items')
            ->when($kasirId !== null, fn (Builder $query) => $query->where('user_id', $kasirId))
            ->when($search !== '', fn (Builder $query) => $query
                ->where('invoice_number', 'like', "%{$search}%"))
            ->when(
                $kasirId === null ? ($filters['kasir'] ?? null) : null,
                fn (Builder $query, $kasir) => $query->where('user_id', $kasir),
            )
            ->when(
                in_array($filters['payment_method'] ?? null, ['tunai', 'qris', 'transfer', 'kartu'], true),
                fn (Builder $query) => $query->where('payment_method', $filters['payment_method']),
            )
            ->when(
                in_array($filters['status'] ?? null, [Transaction::STATUS_PAID, Transaction::STATUS_CANCELLED], true),
                fn (Builder $query) => $query->where('status', $filters['status']),
            )
            ->when($filters['date_from'] ?? null, fn (Builder $query, $from) => $query
                ->whereDate('created_at', '>=', $from->toDateString()))
            ->when($filters['date_to'] ?? null, fn (Builder $query, $to) => $query
                ->whereDate('created_at', '<=', $to->toDateString()))
            ->orderByDesc('created_at')
            ->orderByDesc('id');
    }

    /**
     * Ringkasan laporan penjualan mengikuti filter aktif —
     * transaksi cancelled dikecualikan dari omzet.
     *
     * @param  Builder<Transaction>  $query
     * @return array{count: int, total: int}
     */
    public function salesReportSummary(Builder $query): array
    {
        $paid = (clone $query)
            ->reorder()
            ->where('status', Transaction::STATUS_PAID);

        return [
            'count' => (clone $query)->reorder()->count(),
            'total' => (int) $paid->sum('total'),
        ];
    }

    /**
     * Laporan Pembelian — query dasar untuk halaman & export.
     *
     * @param  array{search?: string, supplier?: int|string|null, date_from?: CarbonImmutable|null, date_to?: CarbonImmutable|null}  $filters
     * @return Builder<Purchase>
     */
    public function purchaseReportQuery(array $filters): Builder
    {
        $search = trim((string) ($filters['search'] ?? ''));

        return Purchase::query()
            ->with(['supplier' => fn ($query) => $query->withTrashed()->select('id', 'name')])
            ->withCount('items')
            ->when($search !== '', fn (Builder $query) => $query
                ->where('invoice_number', 'like', "%{$search}%"))
            ->when($filters['supplier'] ?? null, fn (Builder $query, $supplier) => $query
                ->where('supplier_id', $supplier))
            ->when($filters['date_from'] ?? null, fn (Builder $query, $from) => $query
                ->where('purchase_date', '>=', $from->toDateString()))
            ->when($filters['date_to'] ?? null, fn (Builder $query, $to) => $query
                ->where('purchase_date', '<=', $to->toDateString()))
            ->orderByDesc('purchase_date')
            ->orderByDesc('id');
    }

    /**
     * Laporan Pengeluaran — query dasar untuk halaman & export.
     *
     * @param  array{search?: string, category?: int|string|null, payment_method?: string|null, date_from?: CarbonImmutable|null, date_to?: CarbonImmutable|null}  $filters
     * @return Builder<Expense>
     */
    public function expenseReportQuery(array $filters): Builder
    {
        $search = trim((string) ($filters['search'] ?? ''));

        return Expense::query()
            ->with(['category' => fn ($query) => $query->withTrashed()->select('id', 'name')])
            ->when($search !== '', fn (Builder $query) => $query
                ->where(fn (Builder $query) => $query
                    ->where('expense_number', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")))
            ->when($filters['category'] ?? null, fn (Builder $query, $category) => $query
                ->where('expense_category_id', $category))
            ->when(
                in_array($filters['payment_method'] ?? null, ['tunai', 'qris', 'transfer', 'kartu'], true),
                fn (Builder $query) => $query->where('payment_method', $filters['payment_method']),
            )
            ->when($filters['date_from'] ?? null, fn (Builder $query, $from) => $query
                ->where('expense_date', '>=', $from->toDateString()))
            ->when($filters['date_to'] ?? null, fn (Builder $query, $to) => $query
                ->where('expense_date', '<=', $to->toDateString()))
            ->orderByDesc('expense_date')
            ->orderByDesc('id');
    }

    /**
     * Laporan Stok — Nilai Persediaan = stock × cost_price (cost null
     * dihitung 0). Hanya produk ber-kelola-stok yang punya nilai stok;
     * produk lain tetap tampil dengan stok 0.
     *
     * @param  array{search?: string, category?: int|string|null, status?: string|null}  $filters
     * @return Builder<Product>
     */
    public function stockReportQuery(array $filters): Builder
    {
        $search = trim((string) ($filters['search'] ?? ''));

        return Product::query()
            ->with('category:id,name')
            ->when($search !== '', fn (Builder $query) => $query
                ->where('name', 'like', "%{$search}%"))
            ->when($filters['category'] ?? null, fn (Builder $query, $category) => $query
                ->where('category_id', $category))
            ->when(
                in_array($filters['status'] ?? null, [Product::STATUS_AKTIF, Product::STATUS_HABIS], true),
                fn (Builder $query) => $query->where('status', $filters['status']),
            )
            ->orderBy('name');
    }

    /**
     * Total nilai persediaan mengikuti filter aktif.
     *
     * @param  Builder<Product>  $query
     */
    public function stockReportTotalValue(Builder $query): int
    {
        return (int) (clone $query)
            ->reorder()
            ->sum(DB::raw('stock * COALESCE(cost_price, 0)'));
    }

    /**
     * Item transaksi paid 30 hari terakhir — basis top produk,
     * kategori terlaris, dan rata-rata item per transaksi.
     *
     * @return Builder<TransactionItem>
     */
    private function paidItemsLast30Days(): Builder
    {
        return TransactionItem::query()
            ->whereHas('transaction', fn (Builder $query) => $query
                ->where('status', Transaction::STATUS_PAID)
                ->where('created_at', '>=', now()->subDays(29)->startOfDay()));
    }
}
