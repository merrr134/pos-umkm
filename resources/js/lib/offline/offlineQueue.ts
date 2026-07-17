import { ReceiptTransaction } from '@/Pages/Kasir/kasir';
import { idbDelete, idbGetAll, idbPut, STORE_QUEUE } from './db';

/**
 * Antrean transaksi offline (Fase 15 — PRD 5.14).
 *
 * Setiap transaksi yang dibuat tanpa koneksi disimpan di IndexedDB
 * dengan status `pending`, lalu disinkronkan satu per satu oleh
 * syncService. Status mengikuti spesifikasi: pending → syncing →
 * synced / failed. Data tidak pernah dihapus otomatis kecuali sudah
 * synced lebih dari 24 jam (jejak untuk daftar sinkronisasi).
 */

export type OfflineTxStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export interface OfflineTransaction {
    client_uuid: string;
    /** Body POST /kasir/bayar — sudah termasuk client_uuid. */
    payload: Record<string, unknown>;
    /** Struk lokal (snapshot saat transaksi dibuat) untuk cetak/daftar. */
    receipt: ReceiptTransaction;
    status: OfflineTxStatus;
    /** Pesan kegagalan sinkronisasi terakhir (Bahasa Indonesia). */
    error: string | null;
    created_at: string;
    /** Nomor invoice final dari server setelah synced. */
    server_invoice: string | null;
}

const SYNCED_RETENTION_MS = 24 * 60 * 60 * 1000;

export async function enqueueTransaction(
    payload: Record<string, unknown>,
    receipt: ReceiptTransaction,
): Promise<OfflineTransaction> {
    const item: OfflineTransaction = {
        client_uuid: String(payload.client_uuid),
        payload,
        receipt,
        status: 'pending',
        error: null,
        created_at: new Date().toISOString(),
        server_invoice: null,
    };

    await idbPut(STORE_QUEUE, item);
    return item;
}

/** Seluruh isi antrean, urut waktu dibuat (paling lama dulu). */
export async function listTransactions(): Promise<OfflineTransaction[]> {
    const items = await idbGetAll<OfflineTransaction>(STORE_QUEUE);
    return items.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function updateTransaction(
    clientUuid: string,
    patch: Partial<
        Pick<OfflineTransaction, 'status' | 'error' | 'server_invoice'>
    >,
): Promise<OfflineTransaction | null> {
    const items = await idbGetAll<OfflineTransaction>(STORE_QUEUE);
    const item = items.find((it) => it.client_uuid === clientUuid);
    if (!item) return null;

    const updated = { ...item, ...patch };
    await idbPut(STORE_QUEUE, updated);
    return updated;
}

export async function removeTransaction(clientUuid: string): Promise<void> {
    await idbDelete(STORE_QUEUE, clientUuid);
}

/** Jumlah per status — bahan indikator sinkronisasi. */
export async function countByStatus(): Promise<
    Record<OfflineTxStatus, number>
> {
    const counts: Record<OfflineTxStatus, number> = {
        pending: 0,
        syncing: 0,
        failed: 0,
        synced: 0,
    };

    for (const item of await listTransactions()) {
        counts[item.status] += 1;
    }

    return counts;
}

/** Hapus jejak synced yang sudah lama — antrean tetap ringkas. */
export async function purgeSyncedTransactions(
    retentionMs: number = SYNCED_RETENTION_MS,
    now: number = Date.now(),
): Promise<void> {
    for (const item of await listTransactions()) {
        if (
            item.status === 'synced' &&
            now - new Date(item.created_at).getTime() > retentionMs
        ) {
            await removeTransaction(item.client_uuid);
        }
    }
}
