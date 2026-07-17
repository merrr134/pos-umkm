import { AlertTriangleIcon, TrashIcon, XIcon } from '@/Components/Icons';
import Modal from '@/Components/Modal';
import { ToastShell } from '@/Components/motion';
import useSyncStatus from '@/hooks/useSyncStatus';
import {
    listTransactions,
    OfflineTransaction,
    OfflineTxStatus,
    removeTransaction,
} from '@/lib/offline/offlineQueue';
import { deriveSyncIndicator } from '@/lib/offline/syncIndicator';
import { syncService } from '@/lib/offline/syncService';
import { formatRupiah } from '@/Pages/Kasir/kasir';
import { useEffect, useRef, useState } from 'react';

/**
 * Indikator status sinkronisasi + daftar transaksi belum tersinkron
 * (Fase 15 — PRD 5.14): 🟢 Online · 🟡 Pending Sync · 🔵 Sedang
 * Sinkronisasi · 🔴 Gagal. Klik chip → modal daftar antrean dengan
 * tombol sinkron ulang (semua / per transaksi failed).
 */

const statusBadge: Record<OfflineTxStatus, { label: string; cls: string }> = {
    pending: { label: 'Menunggu', cls: 'bg-amber-100 text-amber-700' },
    syncing: { label: 'Sinkronisasi…', cls: 'bg-blue-100 text-blue-700' },
    failed: { label: 'Gagal', cls: 'bg-red-100 text-red-700' },
    synced: { label: 'Tersinkron', cls: 'bg-green-100 text-green-700' },
};

function formatTime(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function SyncIndicator() {
    const snapshot = useSyncStatus();
    const ui = deriveSyncIndicator(snapshot);

    const [showModal, setShowModal] = useState(false);
    const [items, setItems] = useState<OfflineTransaction[]>([]);
    const [removeCandidate, setRemoveCandidate] =
        useState<OfflineTransaction | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const toastTimer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(toastTimer.current), []);

    const showToast = (message: string) => {
        setToast(message);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 4000);
    };

    const loadItems = async () => {
        try {
            setItems(await listTransactions());
        } catch {
            showToast(
                'Penyimpanan offline gagal dibuka — daftar antrean tidak tersedia.',
            );
        }
    };

    // Muat ulang daftar setiap modal terbuka / status berubah
    useEffect(() => {
        if (showModal) void loadItems();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showModal, snapshot.state, snapshot.pending, snapshot.failed]);

    const handleSyncNow = async () => {
        if (!snapshot.online) {
            showToast(
                'Tidak ada koneksi internet. Sinkronisasi berjalan otomatis saat online kembali.',
            );
            return;
        }
        const started = await syncService.syncNow();
        if (!started) {
            showToast('Sinkronisasi sedang berjalan.');
            return;
        }

        await loadItems();
        const after = syncService.getSnapshot();
        if (after.failed > 0) {
            showToast(
                'Sebagian transaksi gagal disinkronkan — lihat pesan pada daftar.',
            );
        } else if (after.pending === 0) {
            showToast('Semua transaksi offline berhasil disinkronkan.');
        }
    };

    const handleRetry = async (item: OfflineTransaction) => {
        await syncService.retry(item.client_uuid);
        await loadItems();
    };

    const handleRemove = async () => {
        if (!removeCandidate) return;
        try {
            await removeTransaction(removeCandidate.client_uuid);
            await syncService.refresh();
            await loadItems();
            showToast('Transaksi gagal sinkron telah dihapus dari antrean.');
        } catch {
            showToast('Gagal menghapus transaksi dari antrean.');
        }
        setRemoveCandidate(null);
    };

    const unsynced = items.filter((item) => item.status !== 'synced');
    const synced = items.filter((item) => item.status === 'synced');

    return (
        <>
            <button
                type="button"
                onClick={() => setShowModal(true)}
                title="Status sinkronisasi — klik untuk melihat antrean"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
                <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 rounded-full ${ui.dotClass}`}
                />
                <span className="hidden sm:inline">{ui.label}</span>
            </button>

            {/* Daftar transaksi belum tersinkron (PRD 5.14 AC) */}
            <Modal
                show={showModal}
                onClose={() => setShowModal(false)}
                maxWidth="lg"
            >
                <div className="p-6">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">
                                Sinkronisasi Transaksi Offline
                            </h2>
                            <p className="text-sm text-slate-500">
                                {ui.emoji} {ui.label}
                                {snapshot.lastError !== null &&
                                    ` — ${snapshot.lastError}`}
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-label="Tutup"
                            onClick={() => setShowModal(false)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                        >
                            <XIcon className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="mt-4 max-h-[50vh] space-y-2.5 overflow-y-auto">
                        {unsynced.length === 0 && synced.length === 0 && (
                            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                                Tidak ada transaksi offline dalam antrean.
                                Semua transaksi sudah tersinkron. 🎉
                            </p>
                        )}

                        {unsynced.map((item) => (
                            <div
                                key={item.client_uuid}
                                className="rounded-xl border border-slate-200 p-3.5"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-slate-900">
                                            {item.receipt.invoice_number}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {formatTime(item.created_at)} ·{' '}
                                            {item.receipt.items.length} item ·{' '}
                                            {formatRupiah(item.receipt.total)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={
                                                'rounded-full px-2.5 py-1 text-xs font-semibold ' +
                                                statusBadge[item.status].cls
                                            }
                                        >
                                            {statusBadge[item.status].label}
                                        </span>
                                        {item.status === 'failed' && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void handleRetry(item)
                                                    }
                                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                                >
                                                    Coba Lagi
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label="Hapus dari antrean"
                                                    onClick={() =>
                                                        setRemoveCandidate(
                                                            item,
                                                        )
                                                    }
                                                    className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {item.error !== null && (
                                    <p className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                                        <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        {item.error}
                                    </p>
                                )}
                            </div>
                        ))}

                        {synced.length > 0 && (
                            <>
                                <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Baru tersinkron
                                </p>
                                {synced.map((item) => (
                                    <div
                                        key={item.client_uuid}
                                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-slate-700">
                                                {item.server_invoice ??
                                                    item.receipt
                                                        .invoice_number}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {formatTime(item.created_at)} ·{' '}
                                                {formatRupiah(
                                                    item.receipt.total,
                                                )}
                                            </p>
                                        </div>
                                        <span
                                            className={
                                                'rounded-full px-2.5 py-1 text-xs font-semibold ' +
                                                statusBadge.synced.cls
                                            }
                                        >
                                            {statusBadge.synced.label}
                                        </span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            Tutup
                        </button>
                        <button
                            type="button"
                            disabled={
                                snapshot.state === 'syncing' ||
                                (snapshot.pending === 0 &&
                                    snapshot.failed === 0)
                            }
                            onClick={() =>
                                snapshot.failed > 0
                                    ? void syncService
                                          .retryAllFailed()
                                          .then(loadItems)
                                    : void handleSyncNow()
                            }
                            className="rounded-xl bg-[#0A45FE] px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {snapshot.state === 'syncing'
                                ? 'Menyinkronkan…'
                                : 'Sinkronkan Sekarang'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Konfirmasi hapus transaksi failed dari antrean */}
            <Modal
                show={removeCandidate !== null}
                onClose={() => setRemoveCandidate(null)}
                maxWidth="md"
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                            <AlertTriangleIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">
                                Hapus dari Antrean
                            </h2>
                            <p className="mt-1 text-slate-500">
                                Transaksi{' '}
                                {removeCandidate?.receipt.invoice_number}{' '}
                                ditolak server dan akan dihapus permanen dari
                                antrean offline. Lanjutkan?
                            </p>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setRemoveCandidate(null)}
                            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleRemove()}
                            className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
                        >
                            Hapus
                        </button>
                    </div>
                </div>
            </Modal>

            <ToastShell
                show={toast !== null}
                className="fixed right-4 top-4 z-[70] flex max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg sm:right-6 sm:top-6"
            >
                <p className="text-sm font-medium text-slate-800">{toast}</p>
            </ToastShell>
        </>
    );
}
