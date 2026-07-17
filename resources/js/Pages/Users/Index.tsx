import {
    BanIcon,
    CheckCircleIcon,
    FolderIcon,
    PencilIcon,
    PlusIcon,
    SearchIcon,
    UserCircleIcon,
} from '@/Components/Icons';
import Pagination from '@/Components/Pagination';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Paginated, Role } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    ComponentType,
    SVGAttributes,
    useEffect,
    useRef,
    useState,
} from 'react';
import FormModal from './FormModal';
import ResetPasswordModal from './ResetPasswordModal';
import { formatLastLogin, ROLE_LABELS, UserRow, UserStats } from './users';

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

/* Konfirmasi aktif/nonaktif (Owner) */
function ToggleStatusModal({
    user,
    onClose,
}: {
    user: UserRow | null;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    const confirmToggle = () => {
        if (!user) return;

        router.post(
            route('users.toggle-status', user.id),
            {},
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: onClose,
                onError: onClose,
            },
        );
    };

    if (user === null) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/40"
                onClick={onClose}
            />
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                <h2 className="text-lg font-bold text-slate-900">
                    {user.is_active
                        ? 'Nonaktifkan Pengguna'
                        : 'Aktifkan Pengguna'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                    {user.is_active
                        ? `Nonaktifkan ${user.name}? User nonaktif tidak bisa login.`
                        : `Aktifkan kembali ${user.name}?`}
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
                        onClick={confirmToggle}
                        className={
                            'rounded-xl px-5 py-2.5 font-semibold text-white shadow-sm transition-colors disabled:opacity-60 ' +
                            (user.is_active
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-[#0A45FE] hover:bg-[#0838d1]')
                        }
                    >
                        {processing
                            ? 'Menyimpan…'
                            : user.is_active
                              ? 'Nonaktifkan'
                              : 'Aktifkan'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Index({
    users,
    filters,
    roles,
    stats,
    can,
}: PageProps<{
    users: Paginated<UserRow>;
    filters: { search: string; role: string | null; status: string | null };
    roles: Role[];
    stats: UserStats;
    can: { manage: boolean };
}>) {
    const [search, setSearch] = useState(filters.search);
    const [roleFilter, setRoleFilter] = useState(filters.role ?? '');
    const [statusFilter, setStatusFilter] = useState(filters.status ?? '');

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<UserRow | null>(null);
    const [resetting, setResetting] = useState<UserRow | null>(null);
    const [toggling, setToggling] = useState<UserRow | null>(null);

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
            if (roleFilter) params.role = roleFilter;
            if (statusFilter) params.status = statusFilter;

            router.get(route('users'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search, roleFilter, statusFilter]);

    const hasActiveFilters =
        search !== '' || roleFilter !== '' || statusFilter !== '';

    const resetFilters = () => {
        setSearch('');
        setRoleFilter('');
        setStatusFilter('');
    };

    const cellClass =
        'border-y border-slate-200 bg-white px-4 py-4 align-middle transition-colors duration-150 group-hover:bg-slate-50';

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Manajemen Pengguna
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Kelola akun, role, dan status pengguna.
                    </p>
                </div>
            }
        >
            <Head title="Manajemen Pengguna" />

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                {can.manage && (
                    <button
                        type="button"
                        onClick={() => {
                            setEditing(null);
                            setShowForm(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A45FE] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Tambah Pengguna
                    </button>
                )}
            </div>

            {/* Statistik */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={UserCircleIcon}
                    chipClass="bg-blue-50 text-[#0A45FE]"
                    label="Total User"
                    value={String(stats.total)}
                />
                <StatCard
                    icon={CheckCircleIcon}
                    chipClass="bg-green-50 text-green-600"
                    label="User Aktif"
                    value={String(stats.aktif)}
                />
                <StatCard
                    icon={BanIcon}
                    chipClass="bg-red-50 text-red-500"
                    label="User Nonaktif"
                    value={String(stats.nonaktif)}
                />
                <StatCard
                    icon={FolderIcon}
                    chipClass="bg-purple-50 text-purple-600"
                    label="Total Role"
                    value={String(stats.total_role)}
                />
            </div>

            {/* Card utama */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                    <div className="relative w-full min-w-[220px] lg:w-auto lg:flex-1">
                        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            placeholder="Cari nama atau username..."
                            aria-label="Cari pengguna"
                            className={filterInputClass + ' w-full pl-11'}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        aria-label="Filter role"
                        value={roleFilter}
                        className={filterSelectClass + ' w-full sm:w-40'}
                        onChange={(e) => setRoleFilter(e.target.value)}
                    >
                        <option value="">Semua Role</option>
                        {roles.map((role) => (
                            <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="Filter status"
                        value={statusFilter}
                        className={filterSelectClass + ' w-full sm:w-40'}
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
                </div>

                {/* Tabel */}
                <div className="overflow-x-auto px-5 sm:px-6">
                    <table className="w-full min-w-[900px] border-separate [border-spacing:0_10px] text-left">
                        <thead>
                            <tr className="text-sm text-slate-500">
                                <th className="px-4 pt-3 font-medium">Foto</th>
                                <th className="px-4 pt-3 font-medium">Nama</th>
                                <th className="px-4 pt-3 font-medium">
                                    Username
                                </th>
                                <th className="px-4 pt-3 font-medium">Role</th>
                                <th className="px-4 pt-3 font-medium">
                                    Status
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Login Terakhir
                                </th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500"
                                    >
                                        {hasActiveFilters
                                            ? 'Pengguna tidak ditemukan. Coba ubah pencarian atau filter.'
                                            : 'Belum ada pengguna.'}
                                    </td>
                                </tr>
                            )}
                            {users.data.map((row) => (
                                <tr key={row.id} className="group">
                                    <td
                                        className={
                                            cellClass + ' rounded-l-xl border-l'
                                        }
                                    >
                                        {row.photo_url ? (
                                            <img
                                                src={row.photo_url}
                                                alt={row.name}
                                                className="h-10 w-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A45FE] text-white">
                                                <UserCircleIcon className="h-6 w-6" />
                                            </span>
                                        )}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' font-medium text-slate-900'
                                        }
                                    >
                                        {row.name}
                                    </td>
                                    <td className={cellClass + ' text-slate-700'}>
                                        @{row.username}
                                    </td>
                                    <td className={cellClass}>
                                        <span
                                            className={
                                                'rounded-full px-3 py-1 text-xs font-semibold ' +
                                                (row.role === 'owner'
                                                    ? 'bg-purple-50 text-purple-600'
                                                    : row.role === 'admin'
                                                      ? 'bg-blue-50 text-[#0A45FE]'
                                                      : 'bg-slate-100 text-slate-600')
                                            }
                                        >
                                            {ROLE_LABELS[row.role]}
                                        </span>
                                    </td>
                                    <td className={cellClass}>
                                        <span
                                            className={
                                                'rounded-full px-3 py-1 text-xs font-semibold ' +
                                                (row.is_active
                                                    ? 'bg-green-50 text-green-600'
                                                    : 'bg-red-50 text-red-600')
                                            }
                                        >
                                            {row.is_active
                                                ? 'Aktif'
                                                : 'Nonaktif'}
                                        </span>
                                    </td>
                                    <td className={cellClass}>
                                        <p className="text-slate-700">
                                            {formatLastLogin(
                                                row.last_login_at,
                                            )}
                                        </p>
                                        {row.last_login_ip && (
                                            <p className="text-xs text-slate-400">
                                                {row.last_login_ip}
                                            </p>
                                        )}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-r-xl border-r text-right'
                                        }
                                    >
                                        {can.manage ? (
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    type="button"
                                                    aria-label={`Edit ${row.name}`}
                                                    title="Edit"
                                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                                    onClick={() => {
                                                        setEditing(row);
                                                        setShowForm(true);
                                                    }}
                                                >
                                                    <PencilIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[#0A45FE] transition-colors hover:bg-blue-50"
                                                    onClick={() =>
                                                        setResetting(row)
                                                    }
                                                >
                                                    Reset Password
                                                </button>
                                                <button
                                                    type="button"
                                                    className={
                                                        'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ' +
                                                        (row.is_active
                                                            ? 'text-red-500 hover:bg-red-50'
                                                            : 'text-green-600 hover:bg-green-50')
                                                    }
                                                    onClick={() =>
                                                        setToggling(row)
                                                    }
                                                >
                                                    {row.is_active
                                                        ? 'Nonaktifkan'
                                                        : 'Aktifkan'}
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-slate-400">
                                                Lihat saja
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-5 py-4 sm:px-6">
                    <Pagination paginator={users} />
                </div>
            </div>

            <FormModal
                show={showForm}
                user={editing}
                onClose={() => {
                    setShowForm(false);
                    setEditing(null);
                }}
            />
            <ResetPasswordModal
                user={resetting}
                onClose={() => setResetting(null)}
            />
            <ToggleStatusModal
                user={toggling}
                onClose={() => setToggling(null)}
            />
        </AuthenticatedLayout>
    );
}
