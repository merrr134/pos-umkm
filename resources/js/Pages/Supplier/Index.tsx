import {
    AlertTriangleIcon,
    BanIcon,
    CheckCircleIcon,
    EyeIcon,
    PencilIcon,
    PlusIcon,
    SearchIcon,
    StoreIcon,
    TrashIcon,
} from '@/Components/Icons';
import Modal from '@/Components/Modal';
import Pagination from '@/Components/Pagination';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Paginated } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ComponentType,
    SVGAttributes,
    useEffect,
    useRef,
    useState,
} from 'react';
import DetailModal from './DetailModal';
import FormModal from './FormModal';
import StatusBadge from './StatusBadge';
import {
    SupplierPermissions,
    SupplierRow,
    SupplierStats,
} from './supplier';

/* Kelas toolbar filter — konsisten dengan halaman Stok & Riwayat */
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

/* Konfirmasi soft delete (Owner) */
function DeleteModal({
    supplier,
    onClose,
}: {
    supplier: SupplierRow | null;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    const confirmDelete = () => {
        if (!supplier) return;

        router.delete(route('supplier.destroy', supplier.id), {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                onClose();
            },
        });
    };

    return (
        <Modal show={supplier !== null} onClose={onClose} maxWidth="md">
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <AlertTriangleIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Hapus Supplier
                        </h2>
                        <p className="mt-1 text-slate-500">
                            Yakin ingin menghapus supplier{' '}
                            <span className="font-semibold text-slate-800">
                                {supplier?.name}
                            </span>
                            ? Supplier akan dipindahkan ke daftar terhapus dan
                            bisa dipulihkan kembali — historinya tetap
                            tersimpan.
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
    supplier,
    onClose,
}: {
    supplier: SupplierRow | null;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    const confirmRestore = () => {
        if (!supplier) return;

        router.post(
            route('supplier.restore', supplier.id),
            {},
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => {
                    setProcessing(false);
                    onClose();
                },
            },
        );
    };

    return (
        <Modal show={supplier !== null} onClose={onClose} maxWidth="md">
            <div className="p-6">
                <h2 className="text-lg font-bold text-slate-900">
                    Pulihkan Supplier
                </h2>
                <p className="mt-1 text-slate-500">
                    Supplier{' '}
                    <span className="font-semibold text-slate-800">
                        {supplier?.name}
                    </span>{' '}
                    akan dikembalikan ke daftar supplier.
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
    suppliers,
    filters,
    stats,
    can,
}: PageProps<{
    suppliers: Paginated<SupplierRow>;
    filters: { search: string; status: string | null; trashed: boolean };
    stats: SupplierStats;
    can: SupplierPermissions;
}>) {
    const { auth, store } = usePage<PageProps>().props;
    const canManage = can.manage;

    const [search, setSearch] = useState(filters.search);
    const [statusFilter, setStatusFilter] = useState(filters.status ?? '');
    const [trashView, setTrashView] = useState(filters.trashed);

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<SupplierRow | null>(null);
    const [viewing, setViewing] = useState<SupplierRow | null>(null);
    const [deleting, setDeleting] = useState<SupplierRow | null>(null);
    const [restoring, setRestoring] = useState<SupplierRow | null>(null);

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
            if (statusFilter) params.status = statusFilter;
            if (trashView) params.trashed = '1';

            router.get(route('supplier'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search, statusFilter, trashView]);

    const hasActiveFilters = search !== '' || statusFilter !== '';

    const resetFilters = () => {
        setSearch('');
        setStatusFilter('');
    };

    const openCreate = () => {
        setEditing(null);
        setShowForm(true);
    };

    const openEdit = (supplier: SupplierRow) => {
        setEditing(supplier);
        setShowForm(true);
    };

    const cellClass =
        'border-y border-slate-200 bg-white px-4 py-4 align-middle transition-colors duration-150 group-hover:bg-slate-50';

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Supplier
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Kelola data supplier {store.name}.
                    </p>
                </div>
            }
        >
            <Head title="Supplier" />

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
                        <span className="rounded-lg bg-[#0A45FE] px-4 py-2 text-sm font-semibold text-white">
                            Supplier
                        </span>
                        <Link
                            href={route('pembelian')}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                        >
                            Pembelian
                        </Link>
                    </div>
                ) : (
                    <span />
                )}

                {canManage && !trashView && (
                    <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A45FE] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Tambah Supplier
                    </button>
                )}
            </div>

            {/* Statistik */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={StoreIcon}
                    chipClass="bg-blue-50 text-[#0A45FE]"
                    label="Total Supplier"
                    value={stats.total}
                />
                <StatCard
                    icon={CheckCircleIcon}
                    chipClass="bg-green-50 text-green-600"
                    label="Supplier Aktif"
                    value={stats.aktif}
                />
                <StatCard
                    icon={BanIcon}
                    chipClass="bg-amber-50 text-amber-500"
                    label="Supplier Nonaktif"
                    value={stats.nonaktif}
                />
                <StatCard
                    icon={TrashIcon}
                    chipClass="bg-red-50 text-red-500"
                    label="Supplier Terhapus"
                    value={stats.terhapus}
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
                            placeholder="Cari kode, nama, kontak, telepon..."
                            aria-label="Cari supplier"
                            className={filterInputClass + ' w-full pl-11'}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        aria-label="Filter status"
                        value={statusFilter}
                        className={filterSelectClass + ' w-full sm:w-44'}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">Semua Status</option>
                        <option value="aktif">Aktif</option>
                        <option value="nonaktif">Nonaktif</option>
                    </select>
                    <button
                        type="button"
                        onClick={resetFilters}
                        disabled={!hasActiveFilters}
                        className="h-12 w-full shrink-0 rounded-xl border border-slate-200 bg-white px-6 font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-default disabled:opacity-50 sm:w-auto"
                    >
                        Reset
                    </button>
                    {can.viewTrash && (
                        <button
                            type="button"
                            onClick={() => setTrashView(!trashView)}
                            className={
                                'inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl border px-5 font-medium shadow-sm transition-colors sm:w-auto ' +
                                (trashView
                                    ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                            }
                        >
                            <TrashIcon className="h-4 w-4" />
                            {trashView
                                ? 'Kembali ke Daftar'
                                : `Terhapus (${stats.terhapus})`}
                        </button>
                    )}
                </div>

                {trashView && (
                    <p className="border-b border-red-100 bg-red-50/60 px-5 py-2.5 text-sm font-medium text-red-600 sm:px-6">
                        Menampilkan supplier terhapus — hanya Owner yang dapat
                        memulihkan.
                    </p>
                )}

                {/* Tabel supplier */}
                <div className="overflow-x-auto px-5 sm:px-6">
                    <table className="w-full min-w-[900px] border-separate [border-spacing:0_10px] text-left">
                        <thead>
                            <tr className="text-sm text-slate-500">
                                <th className="px-4 pt-3 font-medium">Kode</th>
                                <th className="px-4 pt-3 font-medium">Nama</th>
                                <th className="px-4 pt-3 font-medium">
                                    Kontak
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Telepon
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Email
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
                            {suppliers.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500"
                                    >
                                        {trashView
                                            ? 'Tidak ada supplier terhapus.'
                                            : hasActiveFilters
                                              ? 'Supplier tidak ditemukan. Coba ubah pencarian atau filter.'
                                              : 'Belum ada supplier. Tambah supplier pertamamu.'}
                                    </td>
                                </tr>
                            )}
                            {suppliers.data.map((supplier) => (
                                <tr key={supplier.id} className="group">
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-l-xl border-l font-semibold text-[#0A45FE]'
                                        }
                                    >
                                        {supplier.code}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' max-w-56 truncate font-semibold text-slate-900'
                                        }
                                    >
                                        {supplier.name}
                                    </td>
                                    <td
                                        className={
                                            cellClass + ' text-slate-700'
                                        }
                                    >
                                        {supplier.contact_person ?? '—'}
                                    </td>
                                    <td
                                        className={
                                            cellClass + ' text-slate-700'
                                        }
                                    >
                                        {supplier.phone ?? '—'}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' max-w-48 truncate text-slate-700'
                                        }
                                    >
                                        {supplier.email ?? '—'}
                                    </td>
                                    <td className={cellClass}>
                                        <StatusBadge
                                            status={supplier.status}
                                        />
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-r-xl border-r text-right'
                                        }
                                    >
                                        <div className="inline-flex items-center gap-1">
                                            <button
                                                type="button"
                                                aria-label={`Detail ${supplier.name}`}
                                                title="Detail"
                                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                                onClick={() =>
                                                    setViewing(supplier)
                                                }
                                            >
                                                <EyeIcon className="h-5 w-5" />
                                            </button>
                                            {trashView ? (
                                                can.viewTrash && (
                                                    <button
                                                        type="button"
                                                        aria-label={`Pulihkan ${supplier.name}`}
                                                        title="Pulihkan"
                                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-green-600 transition-colors hover:bg-green-50"
                                                        onClick={() =>
                                                            setRestoring(
                                                                supplier,
                                                            )
                                                        }
                                                    >
                                                        <CheckCircleIcon className="h-5 w-5" />
                                                    </button>
                                                )
                                            ) : (
                                                <>
                                                    {canManage && (
                                                        <button
                                                            type="button"
                                                            aria-label={`Edit ${supplier.name}`}
                                                            title="Edit"
                                                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#0A45FE] transition-colors hover:bg-blue-50"
                                                            onClick={() =>
                                                                openEdit(
                                                                    supplier,
                                                                )
                                                            }
                                                        >
                                                            <PencilIcon className="h-5 w-5" />
                                                        </button>
                                                    )}
                                                    {can.delete && (
                                                        <button
                                                            type="button"
                                                            aria-label={`Hapus ${supplier.name}`}
                                                            title="Hapus"
                                                            className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50"
                                                            onClick={() =>
                                                                setDeleting(
                                                                    supplier,
                                                                )
                                                            }
                                                        >
                                                            <TrashIcon className="h-5 w-5" />
                                                        </button>
                                                    )}
                                                </>
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
                    <Pagination paginator={suppliers} />
                </div>
            </div>

            <FormModal
                show={showForm}
                supplier={editing}
                onClose={() => setShowForm(false)}
            />
            <DetailModal
                supplier={viewing}
                onClose={() => setViewing(null)}
            />
            <DeleteModal
                supplier={deleting}
                onClose={() => setDeleting(null)}
            />
            <RestoreModal
                supplier={restoring}
                onClose={() => setRestoring(null)}
            />
        </AuthenticatedLayout>
    );
}
