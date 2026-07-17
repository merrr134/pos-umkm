import {
    AlertTriangleIcon,
    BanIcon,
    BoxIcon,
    CheckCircleIcon,
    ClockIcon,
    ImageIcon,
    PencilIcon,
    PlusIcon,
    SearchIcon,
} from '@/Components/Icons';
import Pagination from '@/Components/Pagination';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Category, PageProps, Paginated } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ComponentType,
    SVGAttributes,
    useEffect,
    useRef,
    useState,
} from 'react';
import AdjustmentModal from './AdjustmentModal';
import MovementModal from './MovementModal';
import RestockModal from './RestockModal';
import { StockRow, StockStats } from './stok';
import StockBadge from './StockBadge';

/* Kelas toolbar filter — konsisten dengan halaman Riwayat & Produk */
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
    value: number;
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
                <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
        </div>
    );
}

export default function Index({
    products,
    categories,
    filters,
    stats,
}: PageProps<{
    products: Paginated<StockRow>;
    categories: Category[];
    filters: {
        search: string;
        category: number | null;
        stock_status: string | null;
    };
    stats: StockStats;
}>) {
    const { auth, store } = usePage<PageProps>().props;
    // Kasir view-only; adjustment & restock hanya Owner/Admin (Fase 7)
    const canManage = auth.user.role !== 'kasir';

    const [search, setSearch] = useState(filters.search);
    const [categoryFilter, setCategoryFilter] = useState(
        filters.category !== null ? String(filters.category) : '',
    );
    const [statusFilter, setStatusFilter] = useState(
        filters.stock_status ?? '',
    );

    const [adjusting, setAdjusting] = useState<StockRow | null>(null);
    const [restocking, setRestocking] = useState<StockRow | null>(null);
    const [viewingHistory, setViewingHistory] = useState<StockRow | null>(
        null,
    );

    const isFirstRender = useRef(true);

    // Search realtime + debounce 300ms (PRD Bab 11)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = window.setTimeout(() => {
            const params: Record<string, string> = {};
            if (search) params.search = search;
            if (categoryFilter) params.category = categoryFilter;
            if (statusFilter) params.stock_status = statusFilter;

            router.get(route('stok'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search, categoryFilter, statusFilter]);

    const hasActiveFilters =
        search !== '' || categoryFilter !== '' || statusFilter !== '';

    const resetFilters = () => {
        setSearch('');
        setCategoryFilter('');
        setStatusFilter('');
    };

    const cellClass =
        'border-y border-slate-200 bg-white px-4 py-4 align-middle transition-colors duration-150 group-hover:bg-slate-50';

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Manajemen Stok
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Pantau stok, penyesuaian, dan pergerakan stok produk{' '}
                        {store.name}.
                    </p>
                </div>
            }
        >
            <Head title="Manajemen Stok" />

            {/* Tab sub-menu Produk (PRD 4.1) — hanya Owner/Admin yang
                punya akses ke halaman Produk & Kategori */}
            {canManage && (
                <div className="pt-1">
                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
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
                        <span className="rounded-lg bg-[#0A45FE] px-4 py-2 text-sm font-semibold text-white">
                            Manajemen Stok
                        </span>
                        <Link
                            href={route('supplier')}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                        >
                            Supplier
                        </Link>
                        <Link
                            href={route('pembelian')}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                        >
                            Pembelian
                        </Link>
                    </div>
                </div>
            )}

            {/* Statistik level stok */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={BoxIcon}
                    chipClass="bg-blue-50 text-[#0A45FE]"
                    label="Total Produk"
                    value={stats.total}
                />
                <StatCard
                    icon={CheckCircleIcon}
                    chipClass="bg-green-50 text-green-600"
                    label="Stok Normal"
                    value={stats.normal}
                />
                <StatCard
                    icon={AlertTriangleIcon}
                    chipClass="bg-amber-50 text-amber-500"
                    label="Stok Menipis"
                    value={stats.menipis}
                />
                <StatCard
                    icon={BanIcon}
                    chipClass="bg-red-50 text-red-500"
                    label="Stok Habis"
                    value={stats.habis}
                />
            </div>

            {/* Card utama: filter + tabel + pagination */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Toolbar filter */}
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                    <div className="relative w-full min-w-[220px] lg:w-auto lg:flex-1">
                        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            placeholder="Cari produk..."
                            aria-label="Cari produk"
                            className={filterInputClass + ' w-full pl-11'}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        aria-label="Filter kategori"
                        value={categoryFilter}
                        className={filterSelectClass + ' w-full sm:w-48'}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="">Semua Kategori</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="Filter status stok"
                        value={statusFilter}
                        className={filterSelectClass + ' w-full sm:w-48'}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">Semua Status Stok</option>
                        <option value="normal">Normal</option>
                        <option value="menipis">Stok Menipis</option>
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

                {/* Tabel stok */}
                <div className="overflow-x-auto px-5 sm:px-6">
                    <table className="w-full min-w-[820px] border-separate [border-spacing:0_10px] text-left">
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
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500"
                                    >
                                        {hasActiveFilters
                                            ? 'Produk tidak ditemukan. Coba ubah pencarian atau filter.'
                                            : 'Belum ada produk. Tambah produk terlebih dahulu.'}
                                    </td>
                                </tr>
                            )}
                            {products.data.map((row) => (
                                <tr key={row.id} className="group">
                                    {/* Foto + nama */}
                                    <td
                                        className={
                                            cellClass + ' rounded-l-xl border-l'
                                        }
                                    >
                                        <div className="flex items-center gap-3.5">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                                                {row.photo_url ? (
                                                    <img
                                                        src={row.photo_url}
                                                        alt={row.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <ImageIcon className="h-6 w-6 text-slate-300" />
                                                )}
                                            </div>
                                            <p className="min-w-0 truncate font-semibold text-slate-900">
                                                {row.name}
                                            </p>
                                        </div>
                                    </td>

                                    <td className={cellClass}>
                                        {row.category && (
                                            <span className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                                {row.category}
                                            </span>
                                        )}
                                    </td>

                                    <td
                                        className={
                                            cellClass +
                                            ' text-center font-semibold ' +
                                            (row.stock_status === 'habis'
                                                ? 'text-red-600'
                                                : row.stock_status ===
                                                    'menipis'
                                                  ? 'text-amber-600'
                                                  : 'text-slate-900')
                                        }
                                    >
                                        {row.track_stock ? row.stock : '—'}
                                    </td>

                                    <td
                                        className={
                                            cellClass +
                                            ' text-center text-slate-500'
                                        }
                                    >
                                        {row.track_stock ? row.min_stock : '—'}
                                    </td>

                                    <td className={cellClass}>
                                        <StockBadge
                                            status={row.stock_status}
                                        />
                                    </td>

                                    {/* Aksi: restock & adjustment (Owner/Admin,
                                        produk ber-kelola-stok), riwayat (semua) */}
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-r-xl border-r text-right'
                                        }
                                    >
                                        <div className="inline-flex items-center gap-1">
                                            {canManage && row.track_stock && (
                                                <>
                                                    <button
                                                        type="button"
                                                        aria-label={`Restock ${row.name}`}
                                                        title="Restock"
                                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-green-600 transition-colors hover:bg-green-50"
                                                        onClick={() =>
                                                            setRestocking(row)
                                                        }
                                                    >
                                                        <PlusIcon className="h-5 w-5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={`Penyesuaian stok ${row.name}`}
                                                        title="Penyesuaian stok"
                                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#0A45FE] transition-colors hover:bg-blue-50"
                                                        onClick={() =>
                                                            setAdjusting(row)
                                                        }
                                                    >
                                                        <PencilIcon className="h-5 w-5" />
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                type="button"
                                                aria-label={`Riwayat stok ${row.name}`}
                                                title="Riwayat pergerakan stok"
                                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                                onClick={() =>
                                                    setViewingHistory(row)
                                                }
                                            >
                                                <ClockIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-5 py-4 sm:px-6">
                    <Pagination paginator={products} />
                </div>
            </div>

            <AdjustmentModal
                product={adjusting}
                onClose={() => setAdjusting(null)}
            />
            <RestockModal
                product={restocking}
                onClose={() => setRestocking(null)}
            />
            <MovementModal
                product={viewingHistory}
                onClose={() => setViewingHistory(null)}
            />
        </AuthenticatedLayout>
    );
}
