import { ReceiptTransaction } from '@/Pages/Kasir/kasir';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDbForTests } from '../db';
import {
    enqueueTransaction,
    listTransactions,
    updateTransaction,
} from '../offlineQueue';
import {
    classifySyncError,
    SYNC_MESSAGES,
    SyncService,
} from '../syncService';

async function clearDatabase(): Promise<void> {
    resetDbForTests();
    await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('pitou-pos-offline');
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
    });
}

function fakeReceipt(uuid: string): ReceiptTransaction {
    return {
        id: 0,
        invoice_number: 'OFFLINE-' + uuid,
        date: new Date().toISOString(),
        kasir: 'Budi',
        items: [],
        subtotal: 10000,
        discount: 0,
        tax_name: null,
        tax_percent: 0,
        tax_amount: 0,
        rounding: 0,
        total: 10000,
        payment_method: 'tunai',
        payment_method_label: 'Tunai',
        paid_amount: 10000,
        change_amount: 0,
        customer_phone: null,
    };
}

async function enqueue(uuid: string) {
    return enqueueTransaction(
        { client_uuid: uuid, items: [], payment_method: 'tunai' },
        fakeReceipt(uuid),
    );
}

function okResponse(invoice: string) {
    return { data: { transaction: { invoice_number: invoice } } };
}

function httpError(status: number, errors?: Record<string, string[]>) {
    return { response: { status, data: errors ? { errors } : {} } };
}

describe('classifySyncError', () => {
    it('tanpa response → network', () => {
        expect(classifySyncError({}).kind).toBe('network');
    });

    it('401/419 → session', () => {
        expect(classifySyncError(httpError(401)).kind).toBe('session');
        expect(classifySyncError(httpError(419)).kind).toBe('session');
    });

    it('422 → rejected + pesan error pertama', () => {
        const info = classifySyncError(
            httpError(422, { items: ['Stok Kopi tidak mencukupi (sisa 3).'] }),
        );
        expect(info.kind).toBe('rejected');
        expect(info.message).toBe('Stok Kopi tidak mencukupi (sisa 3).');
    });

    it('5xx → server', () => {
        expect(classifySyncError(httpError(500)).kind).toBe('server');
    });
});

describe('SyncService — antrean berurutan', () => {
    beforeEach(clearDatabase);

    it('memproses transaksi satu per satu & menandai synced', async () => {
        await enqueue('a');
        await enqueue('b');

        const order: string[] = [];
        const post = vi.fn((_url: string, body: Record<string, unknown>) => {
            order.push(String(body.client_uuid));
            return Promise.resolve(okResponse('TRX-' + body.client_uuid));
        });

        const service = new SyncService({ post, getOnline: () => true });
        const ran = await service.syncNow();

        expect(ran).toBe(true);
        expect(order).toEqual(['a', 'b']); // berurutan
        const all = await listTransactions();
        expect(all.every((i) => i.status === 'synced')).toBe(true);
        expect(all.find((i) => i.client_uuid === 'a')?.server_invoice).toBe(
            'TRX-a',
        );
        expect(service.getSnapshot().pending).toBe(0);
    });

    it('offline → tidak menjalankan sinkronisasi', async () => {
        await enqueue('a');
        const post = vi.fn();
        const service = new SyncService({ post, getOnline: () => false });

        expect(await service.syncNow()).toBe(false);
        expect(post).not.toHaveBeenCalled();
        expect(service.getSnapshot().lastError).toBe(SYNC_MESSAGES.offline);
    });

    it('guard duplicate sync — panggilan kedua saat berjalan → false', async () => {
        await enqueue('a');

        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const post = vi.fn(async () => {
            await gate; // tahan sinkronisasi tetap "berjalan"
            return okResponse('TRX-a');
        });
        const service = new SyncService({ post, getOnline: () => true });

        const first = service.syncNow();
        // Tunggu hingga sinkronisasi benar-benar in-flight (post terpanggil)
        await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));

        const second = await service.syncNow(); // sedang syncing → dilewati
        expect(second).toBe(false);

        release();
        expect(await first).toBe(true);
        expect(post).toHaveBeenCalledTimes(1); // tidak dobel
    });
});

describe('SyncService — kegagalan', () => {
    beforeEach(clearDatabase);

    it('gagal jaringan → item kembali pending, antrean berhenti', async () => {
        await enqueue('a');
        await enqueue('b');

        const post = vi.fn(() => Promise.reject({}));
        const service = new SyncService({ post, getOnline: () => true });
        await service.syncNow();

        const all = await listTransactions();
        expect(all.every((i) => i.status === 'pending')).toBe(true);
        // Hanya item pertama dicoba lalu berhenti (masalah koneksi)
        expect(post).toHaveBeenCalledTimes(1);
        expect(service.getSnapshot().lastError).toBe(SYNC_MESSAGES.network);
    });

    it('konflik stok (422) → item failed dgn pesan, item lain lanjut', async () => {
        await enqueue('a');
        await enqueue('b');

        const post = vi.fn((_url: string, body: Record<string, unknown>) => {
            if (body.client_uuid === 'a') {
                return Promise.reject(
                    httpError(422, {
                        items: ['Stok Kopi tidak mencukupi (sisa 3).'],
                    }),
                );
            }
            return Promise.resolve(okResponse('TRX-b'));
        });

        const service = new SyncService({ post, getOnline: () => true });
        await service.syncNow();

        const all = await listTransactions();
        const a = all.find((i) => i.client_uuid === 'a');
        const b = all.find((i) => i.client_uuid === 'b');
        expect(a?.status).toBe('failed');
        expect(a?.error).toBe('Stok Kopi tidak mencukupi (sisa 3).');
        expect(b?.status).toBe('synced'); // item lain tetap diproses
        expect(service.getSnapshot().failed).toBe(1);
    });

    it('sesi berakhir (419) → item kembali pending, antrean berhenti', async () => {
        await enqueue('a');
        const post = vi.fn(() => Promise.reject(httpError(419)));
        const service = new SyncService({ post, getOnline: () => true });
        await service.syncNow();

        const all = await listTransactions();
        expect(all[0].status).toBe('pending');
        expect(service.getSnapshot().lastError).toBe(SYNC_MESSAGES.session);
    });

    it('retry mengubah failed → pending lalu menyinkronkan ulang', async () => {
        await enqueue('a');
        await updateTransaction('a', {
            status: 'failed',
            error: 'Stok kurang',
        });

        const post = vi.fn(() => Promise.resolve(okResponse('TRX-a')));
        const service = new SyncService({ post, getOnline: () => true });
        await service.retry('a');

        const all = await listTransactions();
        expect(all[0].status).toBe('synced');
        expect(post).toHaveBeenCalledTimes(1);
    });

    it('retryAllFailed mencoba ulang semua yang failed', async () => {
        await enqueue('a');
        await enqueue('b');
        await updateTransaction('a', { status: 'failed', error: 'x' });
        await updateTransaction('b', { status: 'failed', error: 'y' });

        const post = vi.fn((_url: string, body: Record<string, unknown>) =>
            Promise.resolve(okResponse('TRX-' + body.client_uuid)),
        );
        const service = new SyncService({ post, getOnline: () => true });
        await service.retryAllFailed();

        const all = await listTransactions();
        expect(all.every((i) => i.status === 'synced')).toBe(true);
        expect(post).toHaveBeenCalledTimes(2);
    });
});

describe('SyncService — idempotency', () => {
    beforeEach(clearDatabase);

    it('item yang sudah synced tidak dikirim ulang saat syncNow lagi', async () => {
        await enqueue('a');
        const post = vi.fn(() => Promise.resolve(okResponse('TRX-a')));
        const service = new SyncService({ post, getOnline: () => true });

        await service.syncNow();
        await service.syncNow(); // panggilan kedua

        expect(post).toHaveBeenCalledTimes(1); // hanya sekali → tidak dobel
    });
});
