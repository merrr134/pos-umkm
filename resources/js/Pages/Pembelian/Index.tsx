import {
    BoxIcon,
    ChartIcon,
    ClockIcon,
    EyeIcon,
    PlusIcon,
    SearchIcon,
    WalletIcon,
} from '@/Components/Icons';
import Pagination from '@/Components/Pagination';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatRupiah } from '@/Pages/Kasir/kasir';
import { PageProps, Paginated } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    ComponentType,
    SVGAttributes,
    useEffect,
    useRef,
    useState,
} from 'react';
import DetailModal from './DetailModal';
import FormModal from './FormModal';
import {
    formatPurchaseDate,
    ProductOption,
    PurchaseDetail,
    PurchaseRow,
    PurchaseStats,
    SupplierOption,
} from './pembelian';

/* Kelas toolbar filter — konsisten dengan halaman Supplier & Stok */
const filterInputClass =
    'h-12 rounded-xl border-slate-200 bg-white px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

const filterSelectClass =
    'h-12 rounded-xl border-slate-200 bg-white pl-4 pr-10 text-slate-900 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

function StatCard({
    icon: IconComponent,
    chipClass,
    label,
    value,
}: {
    icon: ComponentType<SVGAttributes<SVGElement>>;
    chipClass: string;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span
                className={
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ' +
                    chipClass
                }
            >
                <IconComponent className="h-6 w-6" />
            </span>
            <div className="min-w-0">
                <p className="truncate text-sm text-slate-500">{label}</p>
                <p className="truncate text-2xl font-bold text-slate-900">
                    {value}
                </p>
            </div>
        </div>
    );
}

export default function Index({
    purchases,
    filters,
    suppliers,
    products,
    stats,
    can,
}: PageProps<{
    purchases: Paginated<PurchaseRow>;
    filters: {
        search: string;
        supplier: number | null;
        date_from: string;
        date_to: string;
    };
    suppliers: SupplierOption[];
    products: ProductOption[];
    stats: PurchaseStats;
    can: { create: boolean };
}>) {
    const { auth, store } = usePage<PageProps>().props;

    const [search, setSearch] = useState(filters.search);
    const [supplierFilter, setSupplierFilter] = useState(
        filters.supplier !== null ? String(filters.supplier) : '',
    );
    const [dateFrom, setDateFrom] = useState(filters.date_from);
    const [dateTo, setDateTo] = useState(filters.date_to);

    const [showForm, setShowForm] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [detail, setDetail] = useState<PurchaseDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const isFirstRender = useRef(true);

    // Filter realtime + debounce 300ms (PRD Bab 11)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = window.setTimeout(() => {
            const params: Record<string, string> = {};
            if (search) params.search = search;
            if (supplierFilter) params.supplier = supplierFilter;
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;

            router.get(route('pembelian'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search, supplierFilter, dateFrom, dateTo]);

    const hasActiveFilters =
        search !== '' ||
        supplierFilter !== '' ||
        dateFrom !== '' ||
        dateTo !== '';

    const resetFilters = () => {
        setSearch('');
        setSupplierFilter('');
        setDateFrom('');
        setDateTo('');
    };

    const openDetail = async (row: PurchaseRow) => {
        setShowDetail(true);
        setDetailLoading(true);
        setDetail(null);

        try {
            const response = await axios.get<{ purchase: PurchaseDetail }>(
                route('pembelian.show', row.id),
            );

            setDetail(response.data.purchase);
        } finally {
            setDetailLoading(false);
        }
    };

    const cellClass =
        'border-y border-slate-200 bg-white px-4 py-4 align-middle transition-colors duration-150 group-hover:bg-slate-50';

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Pembelian
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Catat pembelian stok dari supplier {store.name}.
                    </p>
                </div>
            }
        >
            <Head title="Pembelian" />

            {/* Tab sub-menu Produk (PRD 4.1) — Owner/Admin */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {auth.user.role !== 'kasir' ? (
                    <div className="flex max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm [scrollbar-width:none] [&>*]:shrink-0 [&>*]:whitespace-nowrap [&::-webkit-scrollbar]:hidden">
                        <Link
                            href={route('produk')}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                        >
                            Daftar Produk
                        </Link>
                        <Link
                            href={route('kategori')}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                        >
                            Kategori Produk
                        </Link>
                        <Link
                            href={route('stok')}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                        >
                            Manajemen Stok
                        </Link>
                        <Link
                            href={route('supplier')}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                        >
                            Supplier
                        </Link>
                        <span className="rounded-lg bg-[#0A45FE] px-4 py-2 text-sm font-semibold text-white">
                            Pembelian
                        </span>
                    </div>
                ) : (
                    <span />
                )}

                {can.create && (
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A45FE] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Tambah Pembelian
                    </button>
                )}
            </div>

            {/* Statistik */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={BoxIcon}
                    chipClass="bg-blue-50 text-[#0A45FE]"
                    label="Total Purchase"
                    value={String(stats.total)}
                />
                <StatCard
                    icon={ClockIcon}
                    chipClass="bg-green-50 text-green-600"
                    label="Hari Ini"
                    value={String(stats.hari_ini)}
                />
                <StatCard
                    icon={ChartIcon}
                    chipClass="bg-purple-50 text-purple-600"
                    label="Bulan Ini"
                    value={String(stats.bulan_ini)}
                />
                <StatCard
                    icon={WalletIcon}
                    chipClass="bg-amber-50 text-amber-500"
                    label="Total Nilai Pembelian"
                    value={formatRupiah(stats.total_nilai)}
                />
            </div>

            {/* Card utama: toolbar + tabel + pagination */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                    <div className="relative w-full min-w-[220px] lg:w-auto lg:flex-1">
                        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            placeholder="Cari nomor atau supplier..."
                            aria-label="Cari pembelian"
                            className={filterInputClass + ' w-full pl-11'}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        aria-label="Filter supplier"
                        value={supplierFilter}
                        className={filterSelectClass + ' w-full sm:w-52'}
                        onChange={(e) => setSupplierFilter(e.target.value)}
                    >
                        <option value="">Semua Supplier</option>
                        {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
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

                {/* Tabel pembelian */}
                <div className="overflow-x-auto px-5 sm:px-6">
                    <table className="w-full min-w-[900px] border-separate [border-spacing:0_10px] text-left">
                        <thead>
                            <tr className="text-sm text-slate-500">
                                <th className="px-4 pt-3 font-medium">
                                    Nomor
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Tanggal
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Supplier
                                </th>
                                <th className="px-4 pt-3 text-center font-medium">
                                    Jumlah Item
                                </th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Total
                                </th>
                                <th className="px-4 pt-3 font-medium">User</th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500"
                                    >
                                        {hasActiveFilters
                                            ? 'Pembelian tidak ditemukan. Coba ubah pencarian atau filter.'
                                            : 'Belum ada pembelian tercatat.'}
                                    </td>
                                </tr>
                            )}
                            {purchases.data.map((row) => (
                                <tr key={row.id} className="group">
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-l-xl border-l font-semibold text-[#0A45FE]'
                                        }
                                    >
                                        {row.invoice_number}
                                    </td>
                                    <td
                                        className={
                                            cellClass + ' text-slate-700'
                                        }
                                    >
                                        {formatPurchaseDate(
                                            row.purchase_date,
                                        )}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' max-w-56 truncate font-medium text-slate-900'
                                        }
                                    >
                                        {row.supplier}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' text-center text-slate-700'
                                        }
                                    >
                                        {row.items_count}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' text-right font-semibold text-slate-900'
                                        }
                                    >
                                        {formatRupiah(row.total)}
                                    </td>
                                    <td
                                        className={
                                            cellClass + ' text-slate-700'
                                        }
                                    >
                                        {row.user}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-r-xl border-r text-right'
                                        }
                                    >
                                        <button
                                            type="button"
                                            aria-label={`Detail ${row.invoice_number}`}
                                            title="Detail"
                                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                            onClick={() => openDetail(row)}
                                        >
                                            <EyeIcon className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-5 py-4 sm:px-6">
                    <Pagination paginator={purchases} />
                </div>
            </div>

            <FormModal
                show={showForm}
                suppliers={suppliers}
                products={products}
                onClose={() => setShowForm(false)}
            />
            <DetailModal
                show={showDetail}
                detail={detail}
                loading={detailLoading}
                onClose={() => setShowDetail(false)}
            />
        </AuthenticatedLayout>
    );
}
