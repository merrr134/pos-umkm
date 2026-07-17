import {
    BanIcon,
    EyeIcon,
    PrinterIcon,
    SearchIcon,
} from '@/Components/Icons';
import Pagination from '@/Components/Pagination';
import PrinterPanel from '@/Components/PrinterPanel';
import { SkeletonRows } from '@/Components/TableSkeleton';
import useNavigating from '@/hooks/useNavigating';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatRupiah, ReceiptProfile } from '@/Pages/Kasir/kasir';
import { PageProps, Paginated, PaymentMethod, User } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import CancelModal from './CancelModal';
import DetailModal from './DetailModal';
import ReprintModal from './ReprintModal';
import {
    formatDate,
    formatTime,
    RiwayatFilters,
    TransactionDetail,
    TransactionRow,
} from './riwayat';
import StatusBadge from './StatusBadge';

/*
 * Kelas bersama toolbar filter — tinggi seragam 48px (h-12), radius,
 * border, dan shadow konsisten dengan halaman Produk & Pengaturan.
 */
const filterInputClass =
    'h-12 rounded-xl border-slate-200 bg-white px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

const filterSelectClass =
    'h-12 rounded-xl border-slate-200 bg-white pl-4 pr-10 text-slate-900 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

function todayString(): string {
    return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD lokal
}

export default function Index({
    transactions,
    filters,
    kasirs,
    paymentMethods,
    receiptProfile,
}: PageProps<{
    transactions: Paginated<TransactionRow>;
    filters: RiwayatFilters;
    kasirs: Pick<User, 'id' | 'name'>[];
    paymentMethods: Pick<PaymentMethod, 'id' | 'name' | 'code'>[];
    receiptProfile: ReceiptProfile;
}>) {
    const { auth, store } = usePage<PageProps>().props;
    const isOwner = auth.user.role === 'owner';

    const navigating = useNavigating();
    const [dateFrom, setDateFrom] = useState(filters.date_from);
    const [dateTo, setDateTo] = useState(filters.date_to);
    const [search, setSearch] = useState(filters.search);
    const [method, setMethod] = useState(filters.payment_method ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [kasir, setKasir] = useState(
        filters.kasir !== null ? String(filters.kasir) : '',
    );

    // Modal detail / cetak ulang / pembatalan
    const [detail, setDetail] = useState<TransactionDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [showReprint, setShowReprint] = useState(false);
    const [cancelling, setCancelling] = useState<TransactionRow | null>(null);

    const isFirstRender = useRef(true);

    // Filter realtime + debounce 300ms (PRD Bab 11) — date_from/date_to
    // selalu dikirim: kosong berarti tanpa batas tanggal
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = window.setTimeout(() => {
            const params: Record<string, string> = {
                date_from: dateFrom,
                date_to: dateTo,
            };
            if (search) params.search = search;
            if (method) params.payment_method = method;
            if (status) params.status = status;
            if (kasir) params.kasir = kasir;

            router.get(route('riwayat'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [dateFrom, dateTo, search, method, status, kasir]);

    const hasActiveFilters =
        search !== '' ||
        method !== '' ||
        status !== '' ||
        kasir !== '' ||
        dateFrom !== todayString() ||
        dateTo !== todayString();

    const resetFilters = () => {
        setDateFrom(todayString());
        setDateTo(todayString());
        setSearch('');
        setMethod('');
        setStatus('');
        setKasir('');
    };

    const methodLabels = new Map(
        paymentMethods.map((item) => [item.code, item.name]),
    );

    const fetchDetail = async (row: TransactionRow) => {
        setDetailLoading(true);
        setDetail(null);

        try {
            const response = await axios.get<{
                transaction: TransactionDetail;
            }>(route('riwayat.show', row.id));

            setDetail(response.data.transaction);
        } finally {
            setDetailLoading(false);
        }
    };

    const openDetail = (row: TransactionRow) => {
        setShowDetail(true);
        void fetchDetail(row);
    };

    const openReprint = (row: TransactionRow) => {
        setShowReprint(true);
        void fetchDetail(row);
    };

    const cellClass =
        'border-y border-slate-200 bg-white px-4 py-4 align-middle transition-colors duration-150 group-hover:bg-slate-50';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                            Riwayat Transaksi
                        </h1>
                        <p className="hidden text-sm text-slate-500 sm:block">
                            Seluruh transaksi {store.name} — detail, cetak
                            ulang, dan pembatalan.
                        </p>
                    </div>
                    {/* Status & kontrol printer Bluetooth (Fase 14) */}
                    <PrinterPanel storeName={receiptProfile.name} />
                </div>
            }
        >
            <Head title="Riwayat Transaksi" />

            <div className="mt-1 rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Toolbar filter — flex satu baris rapi di desktop lebar,
                    wrap otomatis di layar kecil tanpa komponen terpotong */}
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6 xl:gap-4">
                    {/* Search — porsi flex lebih besar, tapi tidak mendominasi */}
                    <div className="relative w-full min-w-[220px] lg:w-auto lg:flex-1">
                        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            placeholder="Cari nomor transaksi..."
                            aria-label="Cari nomor transaksi"
                            className={filterInputClass + ' w-full pl-11'}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Rentang tanggal — separator "-" di tengah */}
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

                    {kasirs.length > 0 && (
                        <select
                            aria-label="Filter kasir"
                            value={kasir}
                            className={filterSelectClass + ' w-full sm:w-44'}
                            onChange={(e) => setKasir(e.target.value)}
                        >
                            <option value="">Semua Kasir</option>
                            {kasirs.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    )}

                    <select
                        aria-label="Filter metode pembayaran"
                        value={method}
                        className={filterSelectClass + ' w-full sm:w-44'}
                        onChange={(e) => setMethod(e.target.value)}
                    >
                        <option value="">Semua Metode</option>
                        {paymentMethods.map((item) => (
                            <option key={item.id} value={item.code}>
                                {item.name}
                            </option>
                        ))}
                    </select>

                    <select
                        aria-label="Filter status"
                        value={status}
                        className={filterSelectClass + ' w-full sm:w-44'}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="">Semua Status</option>
                        <option value="paid">Berhasil</option>
                        <option value="cancelled">Dibatalkan</option>
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

                {/* Tabel riwayat */}
                <div className="overflow-x-auto px-5 sm:px-6">
                    <table className="w-full min-w-[860px] border-separate [border-spacing:0_10px] text-left">
                        <thead>
                            <tr className="text-sm text-slate-500">
                                <th className="px-4 pt-3 font-medium">
                                    Nomor
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Tanggal
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Kasir
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Metode
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Status
                                </th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Total
                                </th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {navigating && <SkeletonRows cols={7} />}
                            {!navigating && transactions.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500"
                                    >
                                        {hasActiveFilters
                                            ? 'Transaksi tidak ditemukan. Coba ubah filter atau rentang tanggal.'
                                            : 'Belum ada transaksi hari ini.'}
                                    </td>
                                </tr>
                            )}
                            {!navigating && transactions.data.map((row) => (
                                <tr key={row.id} className="group">
                                    <td
                                        className={
                                            cellClass + ' rounded-l-xl border-l'
                                        }
                                    >
                                        <p className="font-semibold text-[#0A45FE]">
                                            {row.invoice_number}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            {row.items_count} item
                                        </p>
                                    </td>
                                    <td className={cellClass}>
                                        <p className="font-medium text-slate-900">
                                            {formatDate(row.date)}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            {formatTime(row.date)}
                                        </p>
                                    </td>
                                    <td
                                        className={
                                            cellClass + ' text-slate-700'
                                        }
                                    >
                                        {row.kasir}
                                    </td>
                                    <td
                                        className={
                                            cellClass + ' text-slate-700'
                                        }
                                    >
                                        {methodLabels.get(
                                            row.payment_method,
                                        ) ?? row.payment_method}
                                    </td>
                                    <td className={cellClass}>
                                        <StatusBadge status={row.status} />
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
                                            cellClass +
                                            ' rounded-r-xl border-r text-right'
                                        }
                                    >
                                        <div className="inline-flex items-center gap-1">
                                            <button
                                                type="button"
                                                aria-label={`Detail ${row.invoice_number}`}
                                                title="Detail"
                                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                                onClick={() => openDetail(row)}
                                            >
                                                <EyeIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Cetak ulang ${row.invoice_number}`}
                                                title="Cetak ulang struk"
                                                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#0A45FE] transition-colors hover:bg-blue-50"
                                                onClick={() =>
                                                    openReprint(row)
                                                }
                                            >
                                                <PrinterIcon className="h-5 w-5" />
                                            </button>
                                            {isOwner &&
                                                row.status === 'paid' && (
                                                    <button
                                                        type="button"
                                                        aria-label={`Batalkan ${row.invoice_number}`}
                                                        title="Batalkan transaksi"
                                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50"
                                                        onClick={() =>
                                                            setCancelling(row)
                                                        }
                                                    >
                                                        <BanIcon className="h-5 w-5" />
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
                    <Pagination paginator={transactions} />
                </div>
            </div>

            <DetailModal
                show={showDetail}
                detail={detail}
                loading={detailLoading}
                canCancel={isOwner}
                onClose={() => setShowDetail(false)}
                onReprint={() => {
                    setShowDetail(false);
                    setShowReprint(true);
                }}
                onCancel={() => {
                    if (detail === null) return;

                    const row = transactions.data.find(
                        (item) => item.id === detail.id,
                    );

                    setShowDetail(false);

                    if (row !== undefined) {
                        setCancelling(row);
                    }
                }}
            />

            <ReprintModal
                show={showReprint}
                detail={detail}
                profile={receiptProfile}
                onClose={() => setShowReprint(false)}
            />

            <CancelModal
                transaction={cancelling}
                onClose={() => setCancelling(null)}
            />
        </AuthenticatedLayout>
    );
}
