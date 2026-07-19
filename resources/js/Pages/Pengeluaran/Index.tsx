import {
    AlertTriangleIcon,
    BanknoteIcon,
    ChartIcon,
    ClockIcon,
    EyeIcon,
    FolderIcon,
    PencilIcon,
    PlusIcon,
    SearchIcon,
    TrashIcon,
    WalletIcon,
} from '@/Components/Icons';
import Modal from '@/Components/Modal';
import Pagination from '@/Components/Pagination';
import { SkeletonRows } from '@/Components/TableSkeleton';
import useNavigating from '@/hooks/useNavigating';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatRupiah } from '@/Pages/Kasir/kasir';
import { PageProps, Paginated } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    ComponentType,
    SVGAttributes,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import CategoryModal from './CategoryModal';
import DetailModal from './DetailModal';
import FormModal from './FormModal';
import {
    ExpenseCategoryOption,
    ExpenseFilters,
    ExpenseRow,
    ExpenseStats,
    formatExpenseDate,
    PaymentMethodOption,
} from './pengeluaran';

/* Kelas toolbar filter — konsisten dengan halaman Pembelian & Supplier */
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

/* Konfirmasi hapus (Owner) — soft delete, bisa dipulihkan dari trash */
function DeleteModal({
    expense,
    onClose,
}: {
    expense: ExpenseRow | null;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    const confirmDelete = () => {
        if (!expense) return;

        router.delete(route('pengeluaran.destroy', expense.id), {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: onClose,
        });
    };

    return (
        <Modal show={expense !== null} onClose={onClose} maxWidth="sm">
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <AlertTriangleIcon className="h-6 w-6" />
                    </span>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Hapus Pengeluaran
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Hapus pengeluaran{' '}
                            <span className="font-semibold">
                                {expense?.expense_number}
                            </span>{' '}
                            ({expense?.title})? Data dapat dipulihkan dari
                            daftar terhapus.
                        </p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        disabled={processing}
                        onClick={confirmDelete}
                        className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
                    >
                        {processing ? 'Menghapus…' : 'Hapus'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

/* Konfirmasi restore (Owner) */
function RestoreModal({
    expense,
    onClose,
}: {
    expense: ExpenseRow | null;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    const confirmRestore = () => {
        if (!expense) return;

        router.post(
            route('pengeluaran.restore', expense.id),
            {},
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: onClose,
            },
        );
    };

    return (
        <Modal show={expense !== null} onClose={onClose} maxWidth="sm">
            <div className="p-6">
                <h2 className="text-lg font-bold text-slate-900">
                    Pulihkan Pengeluaran
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                    Pulihkan pengeluaran{' '}
                    <span className="font-semibold">
                        {expense?.expense_number}
                    </span>{' '}
                    ({expense?.title}) ke daftar aktif?
                </p>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        disabled={processing}
                        onClick={confirmRestore}
                        className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1] disabled:opacity-60"
                    >
                        {processing ? 'Memulihkan…' : 'Pulihkan'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default function Index({
    expenses,
    filters,
    categories,
    payment_methods,
    stats,
    can,
}: PageProps<{
    expenses: Paginated<ExpenseRow>;
    filters: ExpenseFilters;
    categories: ExpenseCategoryOption[];
    payment_methods: PaymentMethodOption[];
    stats: ExpenseStats;
    can: { manage: boolean; delete: boolean; viewTrash: boolean };
}>) {
    const [search, setSearch] = useState(filters.search);
    const [categoryFilter, setCategoryFilter] = useState(
        filters.category !== null ? String(filters.category) : '',
    );
    const [methodFilter, setMethodFilter] = useState(
        filters.payment_method ?? '',
    );
    const [dateFrom, setDateFrom] = useState(filters.date_from);
    const [dateTo, setDateTo] = useState(filters.date_to);
    const [trashView, setTrashView] = useState(filters.trashed);
    const navigating = useNavigating();

    const [showForm, setShowForm] = useState(false);
    const [showCategories, setShowCategories] = useState(false);
    const [editing, setEditing] = useState<ExpenseRow | null>(null);
    const [detail, setDetail] = useState<ExpenseRow | null>(null);
    const [deleting, setDeleting] = useState<ExpenseRow | null>(null);
    const [restoring, setRestoring] = useState<ExpenseRow | null>(null);

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
            if (categoryFilter) params.category = categoryFilter;
            if (methodFilter) params.payment_method = methodFilter;
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;
            if (trashView) params.trashed = '1';

            router.get(route('pengeluaran'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search, categoryFilter, methodFilter, dateFrom, dateTo, trashView]);

    const methodLabels = useMemo(
        () =>
            new Map(
                payment_methods.map((method) => [method.code, method.name]),
            ),
        [payment_methods],
    );

    const methodLabel = (code: string) => methodLabels.get(code) ?? code;

    const hasActiveFilters =
        search !== '' ||
        categoryFilter !== '' ||
        methodFilter !== '' ||
        dateFrom !== '' ||
        dateTo !== '';

    const resetFilters = () => {
        setSearch('');
        setCategoryFilter('');
        setMethodFilter('');
        setDateFrom('');
        setDateTo('');
    };

    const cellClass =
        'border-y border-slate-200 bg-white px-4 py-4 align-middle transition-colors duration-150 group-hover:bg-slate-50';

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Pengeluaran
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Catat biaya operasional cafe — tidak mempengaruhi stok.
                    </p>
                </div>
            }
        >
            <Head title="Pengeluaran" />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {/* Toggle daftar aktif / terhapus — Owner only */}
                {can.viewTrash ? (
                    <div className="flex max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm [scrollbar-width:none] [&>*]:shrink-0 [&>*]:whitespace-nowrap [&::-webkit-scrollbar]:hidden">
                        <button
                            type="button"
                            onClick={() => setTrashView(false)}
                            className={
                                'rounded-lg px-4 py-2 text-sm font-medium transition-colors ' +
                                (!trashView
                                    ? 'bg-[#0A45FE] font-semibold text-white'
                                    : 'text-slate-500 hover:text-slate-800')
                            }
                        >
                            Pengeluaran
                        </button>
                        <button
                            type="button"
                            onClick={() => setTrashView(true)}
                            className={
                                'rounded-lg px-4 py-2 text-sm font-medium transition-colors ' +
                                (trashView
                                    ? 'bg-[#0A45FE] font-semibold text-white'
                                    : 'text-slate-500 hover:text-slate-800')
                            }
                        >
                            Terhapus
                        </button>
                    </div>
                ) : (
                    <span />
                )}

                {can.manage && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setShowCategories(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                        >
                            <FolderIcon className="h-4 w-4" />
                            Kelola Kategori
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setEditing(null);
                                setShowForm(true);
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A45FE] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Tambah Pengeluaran
                        </button>
                    </div>
                )}
            </div>

            {/* Statistik */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={WalletIcon}
                    chipClass="bg-blue-50 text-[#0A45FE]"
                    label="Total Pengeluaran"
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
                    icon={BanknoteIcon}
                    chipClass="bg-amber-50 text-amber-500"
                    label="Total Nominal"
                    value={formatRupiah(stats.total_nominal)}
                />
            </div>

            {/* Card utama: toolbar + tabel + pagination */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                    <div className="relative w-full min-w-[200px] lg:w-auto lg:flex-1">
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
                        aria-label="Filter metode pembayaran"
                        value={methodFilter}
                        className={filterSelectClass + ' w-full sm:w-44'}
                        onChange={(e) => setMethodFilter(e.target.value)}
                    >
                        <option value="">Semua Metode</option>
                        {payment_methods.map((method) => (
                            <option key={method.code} value={method.code}>
                                {method.name}
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

                {/* Tabel pengeluaran */}
                <div className="overflow-x-auto px-5 sm:px-6">
                    <table className="w-full min-w-[980px] border-separate [border-spacing:0_10px] text-left">
                        <thead>
                            <tr className="text-sm text-slate-500">
                                <th className="px-4 pt-3 font-medium">
                                    Nomor
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Tanggal
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Kategori
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Judul
                                </th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Nominal
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Metode
                                </th>
                                <th className="px-4 pt-3 font-medium">User</th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {navigating && <SkeletonRows cols={8} />}
                            {!navigating && expenses.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500"
                                    >
                                        {trashView ? (
                                            'Tidak ada pengeluaran terhapus.'
                                        ) : hasActiveFilters ? (
                                            'Pengeluaran tidak ditemukan. Coba ubah pencarian atau filter.'
                                        ) : (
                                            <>
                                                <p>
                                                    Belum ada pengeluaran
                                                    tercatat.
                                                </p>
                                                {can.manage && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditing(null);
                                                            setShowForm(true);
                                                        }}
                                                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0A45FE] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                                                    >
                                                        <PlusIcon className="h-4 w-4" />
                                                        Tambah Pengeluaran
                                                    </button>
                                                )}
                                            </>
                                        )}
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
                                    <td
                                        className={
                                            cellClass + ' text-slate-700'
                                        }
                                    >
                                        {formatExpenseDate(row.expense_date)}
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
                                            cellClass + ' text-slate-700'
                                        }
                                    >
                                        {methodLabel(row.payment_method)}
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
                                        <div className="flex justify-end gap-1">
                                            <button
                                                type="button"
                                                aria-label={`Detail ${row.expense_number}`}
                                                title="Detail"
                                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                                onClick={() => setDetail(row)}
                                            >
                                                <EyeIcon className="h-5 w-5" />
                                            </button>
                                            {!trashView && can.manage && (
                                                <button
                                                    type="button"
                                                    aria-label={`Edit ${row.expense_number}`}
                                                    title="Edit"
                                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                                    onClick={() => {
                                                        setEditing(row);
                                                        setShowForm(true);
                                                    }}
                                                >
                                                    <PencilIcon className="h-5 w-5" />
                                                </button>
                                            )}
                                            {!trashView && can.delete && (
                                                <button
                                                    type="button"
                                                    aria-label={`Hapus ${row.expense_number}`}
                                                    title="Hapus"
                                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                                    onClick={() =>
                                                        setDeleting(row)
                                                    }
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            )}
                                            {trashView && can.delete && (
                                                <button
                                                    type="button"
                                                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[#0A45FE] transition-colors hover:bg-blue-50"
                                                    onClick={() =>
                                                        setRestoring(row)
                                                    }
                                                >
                                                    Pulihkan
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-5 py-4 sm:px-6">
                    <Pagination paginator={expenses} />
                </div>
            </div>

            <FormModal
                show={showForm}
                expense={editing}
                categories={categories}
                methods={payment_methods}
                onClose={() => {
                    setShowForm(false);
                    setEditing(null);
                }}
            />
            <CategoryModal
                show={showCategories}
                categories={categories}
                onClose={() => setShowCategories(false)}
            />
            <DetailModal
                show={detail !== null}
                expense={detail}
                methodLabel={methodLabel}
                onClose={() => setDetail(null)}
            />
            <DeleteModal expense={deleting} onClose={() => setDeleting(null)} />
            <RestoreModal
                expense={restoring}
                onClose={() => setRestoring(null)}
            />
        </AuthenticatedLayout>
    );
}
