import { SearchIcon } from '@/Components/Icons';
import Pagination from '@/Components/Pagination';
import { SkeletonRows } from '@/Components/TableSkeleton';
import useNavigating from '@/hooks/useNavigating';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatRupiah } from '@/Pages/Kasir/kasir';
import { PageProps, Paginated } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    cellClass,
    ExportButtons,
    filterInputClass,
    filterSelectClass,
    ReportTabs,
} from './components';
import {
    ExpenseReportRow,
    formatReportDate,
    METHOD_LABELS,
    ReportSummary,
} from './laporan';

interface CategoryOption {
    id: number;
    name: string;
}

interface MethodOption {
    id: number;
    name: string;
    code: string;
}

export default function Pengeluaran({
    expenses,
    summary,
    filters,
    categories,
    payment_methods,
}: PageProps<{
    expenses: Paginated<ExpenseReportRow>;
    summary: ReportSummary;
    filters: {
        search: string;
        category: number | null;
        payment_method: string | null;
        date_from: string;
        date_to: string;
    };
    categories: CategoryOption[];
    payment_methods: MethodOption[];
}>) {
    const [search, setSearch] = useState(filters.search);
    const [category, setCategory] = useState(
        filters.category !== null ? String(filters.category) : '',
    );
    const [method, setMethod] = useState(filters.payment_method ?? '');
    const [dateFrom, setDateFrom] = useState(filters.date_from);
    const [dateTo, setDateTo] = useState(filters.date_to);

    const isFirstRender = useRef(true);
    const navigating = useNavigating();

    const params = useMemo(() => {
        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (category) params.category = category;
        if (method) params.payment_method = method;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;

        return params;
    }, [search, category, method, dateFrom, dateTo]);

    // Filter realtime + debounce 300ms (PRD Bab 11)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = window.setTimeout(() => {
            router.get(route('laporan.pengeluaran'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [params]);

    const hasActiveFilters = Object.keys(params).length > 0;

    const resetFilters = () => {
        setSearch('');
        setCategory('');
        setMethod('');
        setDateFrom('');
        setDateTo('');
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Laporan Pengeluaran
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Biaya operasional per kategori & periode.
                    </p>
                </div>
            }
        >
            <Head title="Laporan Pengeluaran" />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <ReportTabs />
                <ExportButtons
                    routeName="laporan.pengeluaran.export"
                    params={params}
                />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                    <div className="relative w-full min-w-[190px] lg:w-auto lg:flex-1">
                        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            placeholder="Cari nomor atau judul..."
                            aria-label="Cari pengeluaran"
                            className={filterInputClass + ' w-full pl-11'}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        aria-label="Filter kategori"
                        value={category}
                        className={filterSelectClass + ' w-full sm:w-48'}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="">Semua Kategori</option>
                        {categories.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="Filter metode pembayaran"
                        value={method}
                        className={filterSelectClass + ' w-full sm:w-44'}
                        onChange={(e) => setMethod(e.target.value)}
                    >
                        <option value="">Semua Metode</option>
                        {payment_methods.map((option) => (
                            <option key={option.code} value={option.code}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                        <input
                            type="date"
                            value={dateFrom}
                            aria-label="Tanggal mulai"
                            className={filterInputClass + ' w-full sm:w-40'}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                        <span className="shrink-0 font-medium text-slate-400">
                            -
                        </span>
                        <input
                            type="date"
                            value={dateTo}
                            aria-label="Tanggal selesai"
                            className={filterInputClass + ' w-full sm:w-40'}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={resetFilters}
                        disabled={!hasActiveFilters}
                        className="h-12 w-full shrink-0 rounded-xl border border-slate-200 bg-white px-6 font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-default disabled:opacity-50 sm:w-auto"
                    >
                        Reset
                    </button>
                </div>

                {/* Tabel */}
                <div className="overflow-x-auto px-5 sm:px-6">
                    <table className="w-full min-w-[900px] border-separate [border-spacing:0_10px] text-left">
                        <thead>
                            <tr className="text-sm text-slate-500">
                                <th className="px-4 pt-3 font-medium">Nomor</th>
                                <th className="px-4 pt-3 font-medium">
                                    Tanggal
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Kategori
                                </th>
                                <th className="px-4 pt-3 font-medium">Judul</th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Nominal
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Metode
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {navigating && <SkeletonRows cols={6} />}
                            {!navigating && expenses.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500"
                                    >
                                        {hasActiveFilters
                                            ? 'Belum ada data untuk periode ini. Coba ubah filter tanggal.'
                                            : 'Belum ada pengeluaran.'}
                                    </td>
                                </tr>
                            )}
                            {!navigating && expenses.data.map((row) => (
                                <tr key={row.id} className="group">
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-l-xl border-l font-semibold text-[#0A45FE]'
                                        }
                                    >
                                        {row.expense_number}
                                    </td>
                                    <td className={cellClass + ' text-slate-700'}>
                                        {formatReportDate(row.expense_date)}
                                    </td>
                                    <td className={cellClass + ' text-slate-700'}>
                                        {row.category}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' max-w-56 truncate font-medium text-slate-900'
                                        }
                                    >
                                        {row.title}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' text-right font-semibold text-slate-900'
                                        }
                                    >
                                        {formatRupiah(row.amount)}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-r-xl border-r text-slate-700'
                                        }
                                    >
                                        {METHOD_LABELS[row.payment_method] ??
                                            row.payment_method}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Ringkasan + pagination */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                    <p className="text-sm text-slate-600">
                        {summary.count} pengeluaran · Total:{' '}
                        <span className="font-bold text-slate-900">
                            {formatRupiah(summary.total)}
                        </span>
                    </p>
                    <Pagination paginator={expenses} />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
