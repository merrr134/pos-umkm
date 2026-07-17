import { ChevronLeftIcon, ChevronRightIcon } from '@/Components/Icons';
import Modal from '@/Components/Modal';
import { Paginated } from '@/types';
import axios from 'axios';
import { useEffect, useState } from 'react';
import {
    formatMovementDate,
    MovementRow,
    movementTypeLabels,
    StockRow,
} from './stok';

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2 px-3 text-sm text-slate-900 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

const typeBadgeClass: Record<string, string> = {
    sale: 'bg-blue-50 text-[#0A45FE]',
    purchase: 'bg-purple-50 text-purple-600',
    adjustment: 'bg-amber-50 text-amber-600',
    restock: 'bg-green-50 text-green-700',
    cancel_transaction: 'bg-red-50 text-red-600',
};

/**
 * Modal Riwayat Pergerakan Stok (Fase 7 — PRD 5.8): seluruh movement
 * produk, filter tanggal + pagination. Log append-only.
 */
export default function MovementModal({
    product,
    onClose,
}: {
    product: StockRow | null;
    onClose: () => void;
}) {
    const [movements, setMovements] =
        useState<Paginated<MovementRow> | null>(null);
    const [page, setPage] = useState(1);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [loading, setLoading] = useState(false);

    // Reset filter saat produk berganti
    useEffect(() => {
        if (product !== null) {
            setMovements(null);
            setPage(1);
            setDateFrom('');
            setDateTo('');
        }
    }, [product]);

    useEffect(() => {
        if (product === null) return;

        let cancelled = false;

        const fetchMovements = async () => {
            setLoading(true);

            try {
                const response = await axios.get<Paginated<MovementRow>>(
                    route('stok.riwayat'),
                    {
                        params: {
                            product: product.id,
                            date_from: dateFrom || undefined,
                            date_to: dateTo || undefined,
                            page,
                        },
                    },
                );

                if (!cancelled) {
                    setMovements(response.data);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void fetchMovements();

        return () => {
            cancelled = true;
        };
    }, [product, page, dateFrom, dateTo]);

    const changeDate = (setter: (value: string) => void) => (value: string) => {
        setter(value);
        setPage(1);
    };

    return (
        <Modal show={product !== null} onClose={onClose} maxWidth="2xl">
            <div className="max-h-[90vh] overflow-y-auto p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Riwayat Pergerakan Stok
                        </h2>
                        <p className="text-sm text-slate-500">
                            {product?.name} — stok saat ini{' '}
                            <span className="font-semibold text-slate-700">
                                {product?.stock}
                            </span>
                        </p>
                    </div>

                    {/* Filter tanggal */}
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateFrom}
                            aria-label="Tanggal mulai"
                            className={inputClass}
                            onChange={(e) =>
                                changeDate(setDateFrom)(e.target.value)
                            }
                        />
                        <span className="text-slate-400">-</span>
                        <input
                            type="date"
                            value={dateTo}
                            aria-label="Tanggal selesai"
                            className={inputClass}
                            onChange={(e) =>
                                changeDate(setDateTo)(e.target.value)
                            }
                        />
                    </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                <th className="px-4 py-2.5 font-medium">
                                    Tanggal
                                </th>
                                <th className="px-4 py-2.5 font-medium">
                                    Jenis
                                </th>
                                <th className="px-4 py-2.5 text-center font-medium">
                                    Qty
                                </th>
                                <th className="px-4 py-2.5 text-center font-medium">
                                    Sebelum
                                </th>
                                <th className="px-4 py-2.5 text-center font-medium">
                                    Sesudah
                                </th>
                                <th className="px-4 py-2.5 font-medium">
                                    User
                                </th>
                                <th className="px-4 py-2.5 font-medium">
                                    Catatan
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-6">
                                        {/* Skeleton loading (PRD Bab 10) */}
                                        <div className="animate-pulse space-y-2">
                                            <div className="h-4 rounded bg-slate-100" />
                                            <div className="h-4 rounded bg-slate-100" />
                                            <div className="h-4 rounded bg-slate-100" />
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!loading && movements?.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-4 py-10 text-center text-slate-500"
                                    >
                                        Belum ada pergerakan stok untuk produk
                                        ini.
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                movements?.data.map((movement) => (
                                    <tr
                                        key={movement.id}
                                        className="border-b border-slate-100 last:border-0"
                                    >
                                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                                            {formatMovementDate(movement.date)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span
                                                className={
                                                    'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
                                                    (typeBadgeClass[
                                                        movement.type
                                                    ] ??
                                                        'bg-slate-100 text-slate-500')
                                                }
                                            >
                                                {movementTypeLabels[
                                                    movement.type
                                                ] ?? movement.type}
                                            </span>
                                        </td>
                                        <td
                                            className={
                                                'px-4 py-2.5 text-center font-semibold ' +
                                                (movement.quantity_change >= 0
                                                    ? 'text-green-600'
                                                    : 'text-red-600')
                                            }
                                        >
                                            {movement.quantity_change > 0
                                                ? '+'
                                                : ''}
                                            {movement.quantity_change}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-slate-700">
                                            {movement.stock_before}
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-medium text-slate-900">
                                            {movement.stock_after}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-700">
                                            {movement.user}
                                        </td>
                                        <td className="max-w-48 px-4 py-2.5 text-slate-500">
                                            {movement.reason ?? '—'}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination sederhana di dalam modal */}
                {movements !== null && movements.total > 0 && (
                    <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-sm text-slate-500">
                            Menampilkan {movements.from ?? 0} -{' '}
                            {movements.to ?? 0} dari {movements.total} data
                        </p>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                aria-label="Halaman sebelumnya"
                                disabled={movements.current_page <= 1 || loading}
                                onClick={() => setPage(page - 1)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-default disabled:opacity-40"
                            >
                                <ChevronLeftIcon className="h-4 w-4" />
                            </button>
                            <span className="px-2 text-sm text-slate-600">
                                {movements.current_page} /{' '}
                                {movements.last_page}
                            </span>
                            <button
                                type="button"
                                aria-label="Halaman berikutnya"
                                disabled={
                                    movements.current_page >=
                                        movements.last_page || loading
                                }
                                onClick={() => setPage(page + 1)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-default disabled:opacity-40"
                            >
                                <ChevronRightIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}

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
        </Modal>
    );
}
