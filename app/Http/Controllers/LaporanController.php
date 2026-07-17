<?php

namespace App\Http\Controllers;

use App\Exports\ExpenseReportExport;
use App\Exports\PurchaseReportExport;
use App\Exports\SalesReportExport;
use App\Exports\StockReportExport;
use App\Models\Category;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Setting;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Laporan & Dashboard Analytics (Fase 10 — PRD 5.12). Seluruh query
 * ada di ReportService; controller hanya merakit filter, memanggil
 * service, dan merender/mengexport. RBAC: Owner & Admin semua
 * laporan; Kasir hanya laporan penjualan miliknya sendiri (tanpa
 * laba/pembelian/pengeluaran — route group + scope query).
 */
class LaporanController extends Controller
{
    private const METHOD_LABELS = [
        'tunai' => 'Tunai',
        'qris' => 'QRIS',
        'transfer' => 'Transfer Bank',
        'kartu' => 'Kartu Debit/Kredit',
    ];

    public function __construct(private readonly ReportService $reports) {}

    /**
     * Dashboard laporan — kartu statistik + grafik + analytics.
     * Kasir dialihkan ke laporan penjualan miliknya (dashboard memuat
     * laba, pembelian, dan pengeluaran yang bukan haknya).
     */
    public function index(Request $request): Response|RedirectResponse
    {
        if ($request->user()->role === User::ROLE_KASIR) {
            return redirect()->route('laporan.penjualan');
        }

        return Inertia::render('Laporan/Index', [
            'stats' => $this->reports->dashboardStats(),
            'charts' => [
                'sales_daily' => $this->reports->salesLast30Days(),
                'top_products' => $this->reports->topProducts(),
                'payment_methods' => $this->reports->paymentMethodBreakdown(),
                'category_sales' => $this->reports->categorySales(),
            ],
            'analytics' => $this->reports->analytics(),
        ]);
    }

    /** Laporan Penjualan — kasir otomatis ter-scope ke transaksinya. */
    public function penjualan(Request $request): Response
    {
        $filters = $this->salesFilters($request);
        $kasirId = $this->scopedKasirId($request);
        $query = $this->reports->salesReportQuery($filters, $kasirId);

        return Inertia::render('Laporan/Penjualan', [
            'transactions' => (clone $query)
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Transaction $transaction) => [
                    'id' => $transaction->id,
                    'invoice_number' => $transaction->invoice_number,
                    'date' => $transaction->created_at->toIso8601String(),
                    'kasir' => $transaction->user->name,
                    'items_count' => $transaction->items_count,
                    'subtotal' => $transaction->subtotal,
                    'discount' => $transaction->discount,
                    'tax_amount' => $transaction->tax_amount,
                    'total' => $transaction->total,
                    'status' => $transaction->status,
                ]),
            'summary' => $this->reports->salesReportSummary($query),
            'filters' => $this->filterProps($filters),
            'kasirs' => $kasirId !== null
                ? []
                : User::query()->orderBy('name')->get(['id', 'name']),
            'payment_methods' => PaymentMethod::query()
                ->orderBy('id')
                ->get(['id', 'name', 'code']),
            'can' => ['viewAll' => $kasirId === null],
        ]);
    }

    public function penjualanExport(Request $request, string $format): HttpResponse
    {
        $filters = $this->salesFilters($request);
        $query = $this->reports->salesReportQuery($filters, $this->scopedKasirId($request));
        $filename = 'laporan-penjualan-'.now()->format('Ymd-Hi');

        if ($format === 'excel') {
            return Excel::download(new SalesReportExport($query), $filename.'.xlsx');
        }

        return Pdf::loadView('reports.penjualan', [
            ...$this->pdfHeader('Laporan Penjualan', $filters),
            'transactions' => $query->get(),
            'summary' => $this->reports->salesReportSummary($query),
        ])->setPaper('a4', 'landscape')->download($filename.'.pdf');
    }

    /** Laporan Pembelian — Owner & Admin (route group). */
    public function pembelian(Request $request): Response
    {
        $filters = $this->purchaseFilters($request);
        $query = $this->reports->purchaseReportQuery($filters);

        return Inertia::render('Laporan/Pembelian', [
            'purchases' => (clone $query)
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Purchase $purchase) => [
                    'id' => $purchase->id,
                    'invoice_number' => $purchase->invoice_number,
                    'purchase_date' => $purchase->purchase_date->toDateString(),
                    'supplier' => $purchase->supplier->name,
                    'items_count' => $purchase->items_count,
                    'total' => $purchase->total,
                ]),
            'summary' => [
                'count' => (clone $query)->reorder()->count(),
                'total' => (int) (clone $query)->reorder()->sum('total'),
            ],
            'filters' => $this->filterProps($filters),
            'suppliers' => Supplier::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function pembelianExport(Request $request, string $format): HttpResponse
    {
        $query = $this->reports->purchaseReportQuery($filters = $this->purchaseFilters($request));
        $filename = 'laporan-pembelian-'.now()->format('Ymd-Hi');

        if ($format === 'excel') {
            return Excel::download(new PurchaseReportExport($query), $filename.'.xlsx');
        }

        return Pdf::loadView('reports.pembelian', [
            ...$this->pdfHeader('Laporan Pembelian', $filters),
            'purchases' => $query->get(),
        ])->download($filename.'.pdf');
    }

    /** Laporan Pengeluaran — Owner & Admin (route group). */
    public function pengeluaran(Request $request): Response
    {
        $filters = $this->expenseFilters($request);
        $query = $this->reports->expenseReportQuery($filters);

        return Inertia::render('Laporan/Pengeluaran', [
            'expenses' => (clone $query)
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Expense $expense) => [
                    'id' => $expense->id,
                    'expense_number' => $expense->expense_number,
                    'expense_date' => $expense->expense_date->toDateString(),
                    'category' => $expense->category->name,
                    'title' => $expense->title,
                    'amount' => $expense->amount,
                    'payment_method' => $expense->payment_method,
                ]),
            'summary' => [
                'count' => (clone $query)->reorder()->count(),
                'total' => (int) (clone $query)->reorder()->sum('amount'),
            ],
            'filters' => $this->filterProps($filters),
            'categories' => ExpenseCategory::query()->orderBy('name')->get(['id', 'name']),
            'payment_methods' => PaymentMethod::query()
                ->orderBy('id')
                ->get(['id', 'name', 'code']),
        ]);
    }

    public function pengeluaranExport(Request $request, string $format): HttpResponse
    {
        $query = $this->reports->expenseReportQuery($filters = $this->expenseFilters($request));
        $filename = 'laporan-pengeluaran-'.now()->format('Ymd-Hi');

        if ($format === 'excel') {
            return Excel::download(new ExpenseReportExport($query), $filename.'.xlsx');
        }

        return Pdf::loadView('reports.pengeluaran', [
            ...$this->pdfHeader('Laporan Pengeluaran', $filters),
            'expenses' => $query->get(),
            'methodLabels' => self::METHOD_LABELS,
        ])->download($filename.'.pdf');
    }

    /** Laporan Stok — Owner & Admin (route group). */
    public function stok(Request $request): Response
    {
        $filters = $this->stockFilters($request);
        $query = $this->reports->stockReportQuery($filters);

        return Inertia::render('Laporan/Stok', [
            'products' => (clone $query)
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Product $product) => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'category' => $product->category->name,
                    'stock' => $product->stock,
                    'min_stock' => $product->min_stock,
                    'track_stock' => $product->track_stock,
                    'status' => $product->status,
                    'cost_price' => $product->cost_price,
                    'price' => $product->price,
                    'stock_value' => $product->stock * ($product->cost_price ?? 0),
                ]),
            'summary' => [
                'count' => (clone $query)->reorder()->count(),
                'total_value' => $this->reports->stockReportTotalValue($query),
            ],
            'filters' => [
                'search' => $filters['search'],
                'category' => $filters['category'] !== null ? (int) $filters['category'] : null,
                'status' => $filters['status'],
            ],
            'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function stokExport(Request $request, string $format): HttpResponse
    {
        $query = $this->reports->stockReportQuery($this->stockFilters($request));
        $filename = 'laporan-stok-'.now()->format('Ymd-Hi');

        if ($format === 'excel') {
            return Excel::download(new StockReportExport($query), $filename.'.xlsx');
        }

        return Pdf::loadView('reports.stok', [
            'storeName' => Setting::getValue('store_name') ?? 'Pitou Cafe',
            'title' => 'Laporan Stok',
            'period' => 'Posisi per '.now()->format('d/m/Y'),
            'products' => $query->get(),
            'totalValue' => $this->reports->stockReportTotalValue($query),
        ])->setPaper('a4', 'landscape')->download($filename.'.pdf');
    }

    /** Kasir hanya boleh melihat transaksinya sendiri (PRD 5.11). */
    private function scopedKasirId(Request $request): ?int
    {
        return $request->user()->role === User::ROLE_KASIR
            ? $request->user()->id
            : null;
    }

    /** @return array<string, mixed> */
    private function salesFilters(Request $request): array
    {
        return [
            'search' => trim((string) $request->query('search', '')),
            'kasir' => $request->query('kasir'),
            'payment_method' => $request->query('payment_method'),
            'status' => $request->query('status'),
            ...$this->dateRange($request),
        ];
    }

    /** @return array<string, mixed> */
    private function purchaseFilters(Request $request): array
    {
        return [
            'search' => trim((string) $request->query('search', '')),
            'supplier' => $request->query('supplier'),
            ...$this->dateRange($request),
        ];
    }

    /** @return array<string, mixed> */
    private function expenseFilters(Request $request): array
    {
        return [
            'search' => trim((string) $request->query('search', '')),
            'category' => $request->query('category'),
            'payment_method' => $request->query('payment_method'),
            ...$this->dateRange($request),
        ];
    }

    /** @return array<string, mixed> */
    private function stockFilters(Request $request): array
    {
        return [
            'search' => trim((string) $request->query('search', '')),
            'category' => $request->query('category'),
            'status' => $request->query('status'),
        ];
    }

    /**
     * Rentang tanggal selalu valid: tanggal tak terparse → null,
     * from > to → ditukar otomatis.
     *
     * @return array{date_from: ?CarbonImmutable, date_to: ?CarbonImmutable}
     */
    private function dateRange(Request $request): array
    {
        $from = $this->parseDate($request->query('date_from'));
        $to = $this->parseDate($request->query('date_to'));

        if ($from !== null && $to !== null && $from->greaterThan($to)) {
            [$from, $to] = [$to, $from];
        }

        return ['date_from' => $from, 'date_to' => $to];
    }

    private function parseDate(?string $value): ?CarbonImmutable
    {
        return rescue(
            fn () => $value !== null && $value !== ''
                ? CarbonImmutable::parse($value)
                : null,
            null,
            report: false,
        );
    }

    /**
     * Bentuk `filters` untuk prop Inertia (tanggal → string).
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function filterProps(array $filters): array
    {
        $props = $filters;
        $props['date_from'] = $filters['date_from']?->toDateString() ?? '';
        $props['date_to'] = $filters['date_to']?->toDateString() ?? '';

        foreach (['kasir', 'supplier', 'category'] as $key) {
            if (array_key_exists($key, $props)) {
                $props[$key] = $props[$key] !== null ? (int) $props[$key] : null;
            }
        }

        return $props;
    }

    /**
     * Variabel header bersama seluruh PDF.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, string>
     */
    private function pdfHeader(string $title, array $filters): array
    {
        $from = $filters['date_from'] ?? null;
        $to = $filters['date_to'] ?? null;

        $period = match (true) {
            $from !== null && $to !== null => $from->format('d/m/Y').' – '.$to->format('d/m/Y'),
            $from !== null => 'Sejak '.$from->format('d/m/Y'),
            $to !== null => 'Sampai '.$to->format('d/m/Y'),
            default => 'Semua tanggal',
        };

        return [
            'storeName' => Setting::getValue('store_name') ?? 'Pitou Cafe',
            'title' => $title,
            'period' => $period,
        ];
    }
}
