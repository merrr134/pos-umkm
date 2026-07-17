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
import { StockReportRow } from './laporan';

interface CategoryOption {
    id: number;
    name: string;
}

export default function Stok({
    products,
    summary,
    filters,
    categories,
}: PageProps<{
    products: Paginated<StockReportRow>;
    summary: { count: number; total_value: number };
    filters: {
        search: string;
        category: number | null;
        status: string | null;
    };
    categories: CategoryOption[];
}>) {
    const [search, setSearch] = useState(filters.search);
    const [category, setCategory] = useState(
        filters.category !== null ? String(filters.category) : '',
    );
    const [status, setStatus] = useState(filters.status ?? '');

    const isFirstRender = useRef(true);
    const navigating = useNavigating();

    const params = useMemo(() => {
        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (category) params.category = category;
        if (status) params.status = status;

        return params;
    }, [search, category, status]);

    // Filter realtime + debounce 300ms (PRD Bab 11)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = window.setTimeout(() => {
            router.get(route('laporan.stok'), params, {
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
        setStatus('');
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Laporan Stok
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Posisi stok & nilai persediaan (stok × harga modal).
                    </p>
                </div>
            }
        >
            <Head title="Laporan Stok" />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <ReportTabs />
                <ExportButtons routeName="laporan.stok.export" params={params} />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                    <div className="relative w-full min-w-[200px] lg:w-auto lg:flex-1">
                        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            placeholder="Cari nama produk..."
                            aria-label="Cari produk"
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
                        aria-label="Filter status"
                        value={status}
                        className={filterSelectClass + ' w-full sm:w-40'}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="">Semua Status</option>
                        <option value="aktif">Aktif</option>
                        <option value="habis">Habis</option>
                    </select>
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
                    <table className="w-full min-w-[1000px] border-separate [border-spacing:0_10px] text-left">
                        <thead>
                            <tr className="text-sm text-slate-500">
                                <th className="px-4 pt-3 font-medium">
                                    Produk
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Kategori
                                </th>
                                <th className="px-4 pt-3 text-center font-medium">
                                    Stok
                                </th>
                                <th className="px-4 pt-3 text-center font-medium">
                                    Minimum
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Status
                                </th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Harga Modal
                                </th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Harga Jual
                                </th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Nilai Persediaan
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {navigating && <SkeletonRows cols={8} />}
                            {!navigating && products.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500"
                                    >
                                        {hasActiveFilters
                                            ? 'Produk tidak ditemukan. Coba ubah pencarian atau filter.'
                                            : 'Belum ada produk.'}
                                    </td>
                                </tr>
                            )}
                            {!navigating && products.data.map((row) => {
                                const lowStock =
                                    row.track_stock &&
                                    row.stock <= row.min_stock;

                                return (
                                    <tr key={row.id} className="group">
                                        <td
                                            className={
                                                cellClass +
                                                ' rounded-l-xl border-l font-medium text-slate-900'
                                            }
                                        >
                                            {row.name}
                                        </td>
                                        <td
                                            className={
                                                cellClass + ' text-slate-700'
                                            }
                                        >
                                            {row.category}
                                        </td>
                                        <td
                                            className={
                                                cellClass +
                                                ' text-center font-semibold ' +
                                                (lowStock
                                                    ? 'text-red-600'
                                                    : 'text-slate-900')
                                            }
                                        >
                                            {row.track_stock
                                                ? row.stock
                                                : '—'}
                                        </td>
                                        <td
                                            className={
                                                cellClass +
                                                ' text-center text-slate-700'
                                            }
                                        >
                                            {row.track_stock
                                                ? row.min_stock
                                                : '—'}
                                        </td>
                                        <td className={cellClass}>
                                            <span
                                                className={
                                                    'rounded-full px-3 py-1 text-xs font-semibold ' +
                                                    (row.status === 'aktif'
                                                        ? 'bg-green-50 text-green-600'
                                                        : 'bg-red-50 text-red-600')
                                                }
                                            >
                                                {row.status === 'aktif'
                                                    ? 'Aktif'
                                                    : 'Habis'}
                                            </span>
                                        </td>
                                        <td
                                            className={
                                                cellClass +
                                                ' text-right text-slate-700'
                                            }
                                        >
                                            {row.cost_price !== null
                                                ? formatRupiah(row.cost_price)
                                                : '—'}
                                        </td>
                                        <td
                                            className={
                                                cellClass +
                                                ' text-right text-slate-700'
                                            }
                                        >
                                            {formatRupiah(row.price)}
                                        </td>
                                        <td
                                            className={
                                                cellClass +
                                                ' rounded-r-xl border-r text-right font-semibold text-slate-900'
                                            }
                                        >
                                            {formatRupiah(row.stock_value)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Ringkasan + pagination */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                    <p className="text-sm text-slate-600">
                        {summary.count} produk · Total nilai persediaan:{' '}
                        <span className="font-bold text-slate-900">
                            {formatRupiah(summary.total_value)}
                        </span>
                    </p>
                    <Pagination paginator={products} />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
