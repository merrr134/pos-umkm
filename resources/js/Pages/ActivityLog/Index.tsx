import { EyeIcon, SearchIcon } from '@/Components/Icons';
import Modal from '@/Components/Modal';
import Pagination from '@/Components/Pagination';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ROLE_LABELS } from '@/Pages/Users/users';
import { PageProps, Paginated, Role } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

interface LogRow {
    id: number;
    time: string; // ISO 8601
    user: string;
    role: Role | null;
    module: string;
    activity: string;
    description: string | null;
    ip_address: string | null;
    user_agent: string | null;
}

const filterInputClass =
    'h-12 rounded-xl border-slate-200 bg-white px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

const filterSelectClass =
    'h-12 rounded-xl border-slate-200 bg-white pl-4 pr-10 text-slate-900 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

function formatTime(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Detail lengkap satu entri log (append-only, murni baca). */
function DetailModal({
    log,
    onClose,
}: {
    log: LogRow | null;
    onClose: () => void;
}) {
    return (
        <Modal show={log !== null} onClose={onClose} maxWidth="lg">
            {log !== null && (
                <div className="max-h-[90vh] overflow-y-auto p-6">
                    <h2 className="text-lg font-bold text-slate-900">
                        Detail Aktivitas
                    </h2>
                    <p className="text-sm font-semibold text-[#0A45FE]">
                        {log.activity}
                    </p>

                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                        <div>
                            <dt className="text-slate-500">Waktu</dt>
                            <dd className="font-medium text-slate-900">
                                {formatTime(log.time)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">User</dt>
                            <dd className="font-medium text-slate-900">
                                {log.user}
                                {log.role && (
                                    <span className="ms-1 text-xs text-slate-500">
                                        ({ROLE_LABELS[log.role]})
                                    </span>
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Modul</dt>
                            <dd className="font-medium text-slate-900">
                                {log.module}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">IP Address</dt>
                            <dd className="font-medium text-slate-900">
                                {log.ip_address ?? '—'}
                            </dd>
                        </div>
                        <div className="col-span-2">
                            <dt className="text-slate-500">Deskripsi</dt>
                            <dd className="font-medium text-slate-900">
                                {log.description ?? '—'}
                            </dd>
                        </div>
                        <div className="col-span-2">
                            <dt className="text-slate-500">Browser</dt>
                            <dd className="break-all font-medium text-slate-900">
                                {log.user_agent ?? '—'}
                            </dd>
                        </div>
                    </dl>

                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

export default function Index({
    logs,
    filters,
    modules,
    roles,
}: PageProps<{
    logs: Paginated<LogRow>;
    filters: {
        search: string;
        role: string | null;
        module: string | null;
        date_from: string;
        date_to: string;
    };
    modules: string[];
    roles: Role[];
}>) {
    const [search, setSearch] = useState(filters.search);
    const [role, setRole] = useState(filters.role ?? '');
    const [module, setModule] = useState(filters.module ?? '');
    const [dateFrom, setDateFrom] = useState(filters.date_from);
    const [dateTo, setDateTo] = useState(filters.date_to);
    const [detail, setDetail] = useState<LogRow | null>(null);

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
            if (role) params.role = role;
            if (module) params.module = module;
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;

            router.get(route('activity-log'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search, role, module, dateFrom, dateTo]);

    const hasActiveFilters =
        search !== '' ||
        role !== '' ||
        module !== '' ||
        dateFrom !== '' ||
        dateTo !== '';

    const resetFilters = () => {
        setSearch('');
        setRole('');
        setModule('');
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
                        Activity Log
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Jejak audit aktivitas — append-only (Owner only).
                    </p>
                </div>
            }
        >
            <Head title="Activity Log" />

            <div className="mt-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                    <div className="relative w-full min-w-[190px] lg:w-auto lg:flex-1">
                        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            placeholder="Cari aktivitas atau user..."
                            aria-label="Cari activity log"
                            className={filterInputClass + ' w-full pl-11'}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        aria-label="Filter role"
                        value={role}
                        className={filterSelectClass + ' w-full sm:w-36'}
                        onChange={(e) => setRole(e.target.value)}
                    >
                        <option value="">Semua Role</option>
                        {roles.map((option) => (
                            <option key={option} value={option}>
                                {ROLE_LABELS[option]}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="Filter modul"
                        value={module}
                        className={filterSelectClass + ' w-full sm:w-44'}
                        onChange={(e) => setModule(e.target.value)}
                    >
                        <option value="">Semua Modul</option>
                        {modules.map((option) => (
                            <option key={option} value={option}>
                                {option}
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
                    <table className="w-full min-w-[1000px] border-separate [border-spacing:0_10px] text-left">
                        <thead>
                            <tr className="text-sm text-slate-500">
                                <th className="px-4 pt-3 font-medium">Waktu</th>
                                <th className="px-4 pt-3 font-medium">User</th>
                                <th className="px-4 pt-3 font-medium">Role</th>
                                <th className="px-4 pt-3 font-medium">Modul</th>
                                <th className="px-4 pt-3 font-medium">
                                    Aktivitas
                                </th>
                                <th className="px-4 pt-3 font-medium">IP</th>
                                <th className="px-4 pt-3 font-medium">
                                    Browser
                                </th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500"
                                    >
                                        {hasActiveFilters
                                            ? 'Tidak ada aktivitas untuk filter ini.'
                                            : 'Belum ada aktivitas tercatat.'}
                                    </td>
                                </tr>
                            )}
                            {logs.data.map((row) => (
                                <tr key={row.id} className="group">
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-l-xl border-l text-slate-700'
                                        }
                                    >
                                        {formatTime(row.time)}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' font-medium text-slate-900'
                                        }
                                    >
                                        {row.user}
                                    </td>
                                    <td className={cellClass}>
                                        {row.role ? (
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
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className={cellClass + ' text-slate-700'}>
                                        {row.module}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' max-w-64 truncate font-medium text-slate-900'
                                        }
                                        title={row.description ?? undefined}
                                    >
                                        {row.activity}
                                    </td>
                                    <td className={cellClass + ' text-slate-700'}>
                                        {row.ip_address ?? '—'}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' max-w-44 truncate text-slate-500'
                                        }
                                        title={row.user_agent ?? undefined}
                                    >
                                        {row.user_agent ?? '—'}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-r-xl border-r text-right'
                                        }
                                    >
                                        <button
                                            type="button"
                                            aria-label={`Detail log ${row.id}`}
                                            title="Detail"
                                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                            onClick={() => setDetail(row)}
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
                    <Pagination paginator={logs} />
                </div>
            </div>

            <DetailModal log={detail} onClose={() => setDetail(null)} />
        </AuthenticatedLayout>
    );
}
