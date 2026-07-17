import axios from 'axios';
import {
    listTransactions,
    OfflineTransaction,
    purgeSyncedTransactions,
    updateTransaction,
} from './offlineQueue';

/**
 * Service sinkronisasi transaksi offline (Fase 15 — PRD 5.14).
 *
 * - Berjalan otomatis saat koneksi kembali (event `online`) dan saat
 *   aplikasi dibuka; bisa juga dipicu manual dari UI.
 * - Antrean diproses BERURUTAN satu per satu (bukan paralel).
 * - Tidak pernah berjalan dobel (guard isSyncing) — bersama dedup
 *   client_uuid di server, retry berkali-kali tidak menghasilkan
 *   transaksi ganda.
 * - Gagal karena jaringan/timeout → item KEMBALI pending (dicoba lagi
 *   nanti); ditolak server (mis. konflik stok) → status failed dengan
 *   pesan jelas; item lain tetap diproses (tidak merusak antrean).
 */

export type SyncState = 'idle' | 'syncing';

export interface SyncSnapshot {
    state: SyncState;
    online: boolean;
    pending: number;
    failed: number;
    /** Pesan kegagalan global terakhir (Bahasa Indonesia) atau null. */
    lastError: string | null;
}

/** Kontrak minimal respons yang dibaca sinkronisasi (server / mock). */
export interface SyncResponse {
    data?: { transaction?: { invoice_number?: string } };
}

type PostFn = (
    url: string,
    body: Record<string, unknown>,
) => Promise<SyncResponse>;

interface SyncServiceOptions {
    post?: PostFn;
    getOnline?: () => boolean;
}

const SYNC_ENDPOINT = '/kasir/bayar';
const REQUEST_TIMEOUT_MS = 20000;

export const SYNC_MESSAGES = {
    offline: 'Tidak ada koneksi internet. Sinkronisasi dicoba lagi otomatis saat online.',
    network:
        'Koneksi terputus saat sinkronisasi. Transaksi tetap tersimpan dan dicoba lagi otomatis.',
    session:
        'Sesi berakhir. Silakan login kembali, transaksi offline akan disinkronkan setelahnya.',
    server: 'Server bermasalah saat sinkronisasi. Akan dicoba lagi.',
};

interface SyncErrorInfo {
    kind: 'network' | 'session' | 'rejected' | 'server';
    message: string;
}

/** Klasifikasi kegagalan sinkronisasi — menentukan nasib item antrean. */
export function classifySyncError(error: unknown): SyncErrorInfo {
    const response = (
        error as {
            response?: {
                status?: number;
                data?: { errors?: Record<string, string[]>; message?: string };
            };
        }
    ).response;

    if (!response) {
        return { kind: 'network', message: SYNC_MESSAGES.network };
    }

    const status = response.status ?? 0;

    if (status === 401 || status === 419) {
        return { kind: 'session', message: SYNC_MESSAGES.session };
    }

    if (status === 422) {
        const firstError =
            response.data?.errors !== undefined
                ? (Object.values(response.data.errors)[0]?.[0] ?? null)
                : null;
        return {
            kind: 'rejected',
            message:
                firstError ??
                response.data?.message ??
                'Transaksi ditolak server.',
        };
    }

    return { kind: 'server', message: SYNC_MESSAGES.server };
}

export class SyncService {
    private syncing = false;
    private initialized = false;
    private lastError: string | null = null;
    private counts = { pending: 0, failed: 0 };
    private listeners = new Set<(snapshot: SyncSnapshot) => void>();
    private readonly post: PostFn;
    private readonly getOnline: () => boolean;

    constructor(options: SyncServiceOptions = {}) {
        this.post =
            options.post ??
            ((url, body) =>
                axios.post(url, body, { timeout: REQUEST_TIMEOUT_MS }));
        this.getOnline =
            options.getOnline ??
            (() =>
                typeof navigator !== 'undefined' ? navigator.onLine : true);
    }

    getSnapshot(): SyncSnapshot {
        return {
            state: this.syncing ? 'syncing' : 'idle',
            online: this.getOnline(),
            pending: this.counts.pending,
            failed: this.counts.failed,
            lastError: this.lastError,
        };
    }

    subscribe(listener: (snapshot: SyncSnapshot) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private emit(): void {
        const snapshot = this.getSnapshot();
        for (const listener of this.listeners) listener(snapshot);
    }

    /**
     * Pasang pemicu otomatis — dipanggil sekali dari layout:
     * saat online kembali & saat aplikasi dibuka (jika ada antrean).
     */
    init(): void {
        if (this.initialized || typeof window === 'undefined') return;
        this.initialized = true;

        window.addEventListener('online', () => {
            void this.syncNow();
        });
        window.addEventListener('offline', () => this.emit());

        void this.refresh().then(() => {
            if (this.getOnline() && this.counts.pending > 0) {
                void this.syncNow();
            }
        });
    }

    /** Hitung ulang jumlah pending/failed dari antrean lalu siarkan. */
    async refresh(): Promise<void> {
        try {
            const items = await listTransactions();
            this.counts = {
                pending: items.filter(
                    (item) =>
                        item.status === 'pending' || item.status === 'syncing',
                ).length,
                failed: items.filter((item) => item.status === 'failed')
                    .length,
            };
        } catch {
            // IndexedDB gagal dibuka → indikator tetap jalan tanpa angka
            this.counts = { pending: 0, failed: 0 };
        }
        this.emit();
    }

    /**
     * Proses antrean satu per satu. Return false bila dilewati
     * (sedang berjalan / offline) — guard "duplicate sync".
     */
    async syncNow(): Promise<boolean> {
        if (this.syncing) return false;

        if (!this.getOnline()) {
            this.lastError = SYNC_MESSAGES.offline;
            this.emit();
            return false;
        }

        this.syncing = true;
        this.lastError = null;
        await this.refresh();

        try {
            const queue = (await listTransactions()).filter(
                (item) =>
                    item.status === 'pending' || item.status === 'syncing',
            );

            for (const item of queue) {
                const proceed = await this.syncItem(item);
                if (!proceed) break; // jaringan/sesi → berhenti, sisanya tetap pending
            }

            await purgeSyncedTransactions();
        } finally {
            this.syncing = false;
            await this.refresh();
        }

        return true;
    }

    /**
     * Sinkronkan satu transaksi. Return false = hentikan antrean
     * (masalah koneksi/sesi yang pasti menimpa item berikutnya juga).
     */
    private async syncItem(item: OfflineTransaction): Promise<boolean> {
        await updateTransaction(item.client_uuid, { status: 'syncing' });
        this.emit();

        try {
            const response = await this.post(SYNC_ENDPOINT, item.payload);
            const invoice =
                (response.data?.transaction?.invoice_number as
                    | string
                    | undefined) ?? null;

            await updateTransaction(item.client_uuid, {
                status: 'synced',
                error: null,
                server_invoice: invoice,
            });
            return true;
        } catch (error) {
            const info = classifySyncError(error);

            if (info.kind === 'network' || info.kind === 'session') {
                // Bukan salah transaksi → kembali pending, coba lagi nanti
                await updateTransaction(item.client_uuid, {
                    status: 'pending',
                    error: info.message,
                });
                this.lastError = info.message;
                return false;
            }

            // Ditolak server (konflik stok, validasi, error 5xx menetap)
            // → failed + pesan jelas; item berikutnya tetap diproses
            await updateTransaction(item.client_uuid, {
                status: 'failed',
                error: info.message,
            });
            return true;
        }
    }

    /** Coba ulang satu transaksi failed (dipicu user dari daftar). */
    async retry(clientUuid: string): Promise<void> {
        await updateTransaction(clientUuid, {
            status: 'pending',
            error: null,
        });
        await this.syncNow();
    }

    /** Coba ulang semua transaksi failed sekaligus. */
    async retryAllFailed(): Promise<void> {
        const failed = (await listTransactions()).filter(
            (item) => item.status === 'failed',
        );
        for (const item of failed) {
            await updateTransaction(item.client_uuid, {
                status: 'pending',
                error: null,
            });
        }
        await this.syncNow();
    }
}

/** Instance tunggal — status sinkronisasi bertahan antar halaman. */
export const syncService = new SyncService();
