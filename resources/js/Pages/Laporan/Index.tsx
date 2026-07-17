import {
    BanknoteIcon,
    BoxIcon,
    CartIcon,
    ChartIcon,
    ClockIcon,
    PercentIcon,
    StoreIcon,
    WalletIcon,
} from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatRupiah } from '@/Pages/Kasir/kasir';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import { motion, useReducedMotion } from 'framer-motion';
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { ChartCard, ReportTabs, StatCard } from './components';
import {
    DashboardAnalytics,
    DashboardCharts,
    DashboardStats,
    METHOD_LABELS,
} from './laporan';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Filler,
);

const PIE_COLORS = ['#0A45FE', '#22c55e', '#a855f7', '#f59e0b'];

/* Format sumbu Y rupiah ringkas: 1.500.000 → "1,5 jt" */
function compactRupiah(value: number): string {
    if (Math.abs(value) >= 1_000_000) {
        return (value / 1_000_000).toLocaleString('id-ID') + ' jt';
    }
    if (Math.abs(value) >= 1_000) {
        return (value / 1_000).toLocaleString('id-ID') + ' rb';
    }

    return value.toLocaleString('id-ID');
}

const moneyTooltip = {
    callbacks: {
        label: (context: { parsed: { y?: number | null; x?: number | null } }) =>
            formatRupiah(context.parsed.y ?? context.parsed.x ?? 0),
    },
};

function AnalyticCard({
    label,
    value,
    hint,
    delay = 0,
}: {
    label: string;
    value: string;
    hint: string | null;
    delay?: number;
}) {
    return (
        <motion.div
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay, ease: 'easeOut' }}
        >
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 truncate text-lg font-bold text-slate-900">
                {value}
            </p>
            <p className="truncate text-xs text-slate-400">
                {hint ?? '30 hari terakhir'}
            </p>
        </motion.div>
    );
}

export default function Index({
    stats,
    charts,
    analytics,
}: PageProps<{
    stats: DashboardStats;
    charts: DashboardCharts;
    analytics: DashboardAnalytics;
}>) {
    // Grafik: 300ms & mati saat Reduce Motion (PRD Bab 14, Fase 13)
    const reduced = useReducedMotion();
    const chartAnimation = { duration: reduced ? 0 : 300 };

    // Laba tampil "N/A" bila belum ada data harga modal (PRD Bab 17)
    const profitValue = (value: number): string =>
        stats.month_sales > 0 && !stats.has_cost_data
            ? 'N/A'
            : formatRupiah(value);

    const salesLine = {
        labels: charts.sales_daily.map((point) =>
            new Date(point.date + 'T00:00:00').toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
            }),
        ),
        datasets: [
            {
                label: 'Omzet',
                data: charts.sales_daily.map((point) => point.total),
                borderColor: '#0A45FE',
                backgroundColor: 'rgba(10, 69, 254, 0.08)',
                pointRadius: 0,
                pointHitRadius: 12,
                tension: 0.3,
                fill: true,
            },
        ],
    };

    const topProductsBar = {
        labels: charts.top_products.map((product) => product.name),
        datasets: [
            {
                label: 'Terjual',
                data: charts.top_products.map((product) => product.quantity),
                backgroundColor: '#0A45FE',
                borderRadius: 6,
            },
        ],
    };

    const paymentPie = {
        labels: charts.payment_methods.map(
            (method) => METHOD_LABELS[method.code] ?? method.code,
        ),
        datasets: [
            {
                data: charts.payment_methods.map((method) => method.total),
                backgroundColor: charts.payment_methods.map(
                    (_, index) => PIE_COLORS[index % PIE_COLORS.length],
                ),
                borderWidth: 1,
            },
        ],
    };

    const categoryBar = {
        labels: charts.category_sales.map((category) => category.name),
        datasets: [
            {
                label: 'Omzet',
                data: charts.category_sales.map((category) => category.total),
                backgroundColor: '#22c55e',
                borderRadius: 6,
            },
        ],
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Laporan
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Dashboard analytics penjualan, pembelian, dan
                        pengeluaran.
                    </p>
                </div>
            }
        >
            <Head title="Laporan" />

            <div className="pt-1">
                <ReportTabs />
            </div>

            {/* Kartu statistik */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={CartIcon}
                    chipClass="bg-blue-50 text-[#0A45FE]"
                    label="Penjualan Hari Ini"
                    value={formatRupiah(stats.today_sales)}
                />
                <StatCard
                    icon={ChartIcon}
                    chipClass="bg-blue-50 text-[#0A45FE]"
                    label="Penjualan Bulan Ini"
                    delay={0.04}
                    value={formatRupiah(stats.month_sales)}
                />
                <StatCard
                    icon={BoxIcon}
                    chipClass="bg-purple-50 text-purple-600"
                    label="Pembelian Bulan Ini"
                    delay={0.08}
                    value={formatRupiah(stats.month_purchases)}
                />
                <StatCard
                    icon={WalletIcon}
                    chipClass="bg-amber-50 text-amber-500"
                    label="Pengeluaran Bulan Ini"
                    delay={0.12}
                    value={formatRupiah(stats.month_expenses)}
                />
                <StatCard
                    icon={PercentIcon}
                    chipClass="bg-green-50 text-green-600"
                    label="Estimasi Laba Kotor"
                    delay={0.16}
                    value={profitValue(stats.gross_profit)}
                    hint="Bulan ini — memakai harga modal saat transaksi"
                />
                <StatCard
                    icon={BanknoteIcon}
                    chipClass="bg-green-50 text-green-600"
                    label="Estimasi Laba Bersih"
                    delay={0.2}
                    value={profitValue(stats.net_profit)}
                    hint="Laba kotor − pengeluaran operasional"
                />
                <StatCard
                    icon={ClockIcon}
                    chipClass="bg-slate-100 text-slate-600"
                    label="Transaksi Hari Ini"
                    delay={0.24}
                    value={String(stats.today_transactions)}
                />
                <StatCard
                    icon={StoreIcon}
                    chipClass="bg-slate-100 text-slate-600"
                    label="Produk Terjual Hari Ini"
                    delay={0.28}
                    value={String(stats.today_items_sold)}
                />
            </div>

            {/* Grafik */}
            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ChartCard
                    title="Penjualan 30 Hari Terakhir"
                    subtitle="Omzet harian — transaksi lunas"
                    empty={charts.sales_daily.every(
                        (point) => point.total === 0,
                    )}
                >
                    <Line
                        data={salesLine}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: chartAnimation,
                            plugins: {
                                legend: { display: false },
                                tooltip: moneyTooltip,
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        callback: (value) =>
                                            compactRupiah(Number(value)),
                                    },
                                },
                            },
                        }}
                    />
                </ChartCard>

                <ChartCard
                    delay={0.06}
                    title="Top 10 Produk Terlaris"
                    subtitle="Jumlah terjual — 30 hari terakhir"
                    empty={charts.top_products.length === 0}
                >
                    <Bar
                        data={topProductsBar}
                        options={{
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: chartAnimation,
                            plugins: { legend: { display: false } },
                            scales: { x: { beginAtZero: true } },
                        }}
                    />
                </ChartCard>

                <ChartCard
                    delay={0.12}
                    title="Metode Pembayaran"
                    subtitle="Omzet per metode — 30 hari terakhir"
                    empty={charts.payment_methods.length === 0}
                >
                    <Pie
                        data={paymentPie}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: chartAnimation,
                            plugins: {
                                legend: { position: 'bottom' },
                                tooltip: {
                                    callbacks: {
                                        label: (context) =>
                                            ` ${formatRupiah(Number(context.parsed))}`,
                                    },
                                },
                            },
                        }}
                    />
                </ChartCard>

                <ChartCard
                    delay={0.18}
                    title="Kategori Produk"
                    subtitle="Omzet per kategori — 30 hari terakhir"
                    empty={charts.category_sales.length === 0}
                >
                    <Bar
                        data={categoryBar}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: chartAnimation,
                            plugins: {
                                legend: { display: false },
                                tooltip: moneyTooltip,
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        callback: (value) =>
                                            compactRupiah(Number(value)),
                                    },
                                },
                            },
                        }}
                    />
                </ChartCard>
            </div>

            {/* Analytics */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnalyticCard
                    label="Produk Terlaris"
                    value={analytics.top_product?.name ?? '—'}
                    hint={
                        analytics.top_product
                            ? `${analytics.top_product.quantity} terjual · ${formatRupiah(analytics.top_product.total)}`
                            : null
                    }
                />
                <AnalyticCard
                    delay={0.04}
                    label="Kasir Terbaik"
                    value={analytics.best_kasir?.name ?? '—'}
                    hint={
                        analytics.best_kasir
                            ? `${analytics.best_kasir.count} transaksi · ${formatRupiah(analytics.best_kasir.total)}`
                            : null
                    }
                />
                <AnalyticCard
                    delay={0.08}
                    label="Supplier Terbanyak"
                    value={analytics.top_supplier?.name ?? '—'}
                    hint={
                        analytics.top_supplier
                            ? `${analytics.top_supplier.count} pembelian · ${formatRupiah(analytics.top_supplier.total)}`
                            : null
                    }
                />
                <AnalyticCard
                    delay={0.12}
                    label="Kategori Terlaris"
                    value={analytics.top_category?.name ?? '—'}
                    hint={
                        analytics.top_category
                            ? `${analytics.top_category.quantity} terjual · ${formatRupiah(analytics.top_category.total)}`
                            : null
                    }
                />
                <AnalyticCard
                    delay={0.16}
                    label="Rata-rata Nilai Transaksi"
                    value={formatRupiah(analytics.avg_transaction_value)}
                    hint={null}
                />
                <AnalyticCard
                    delay={0.2}
                    label="Rata-rata Item per Transaksi"
                    value={String(analytics.avg_items_per_transaction)}
                    hint={null}
                />
            </div>
        </AuthenticatedLayout>
    );
}
