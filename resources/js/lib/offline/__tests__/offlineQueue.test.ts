import { ReceiptTransaction } from '@/Pages/Kasir/kasir';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDbForTests } from '../db';
import {
    countByStatus,
    enqueueTransaction,
    listTransactions,
    purgeSyncedTransactions,
    removeTransaction,
    updateTransaction,
} from '../offlineQueue';

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
        invoice_number: 'OFFLINE-' + uuid.slice(0, 4),
        date: new Date().toISOString(),
        kasir: 'Budi',
        items: [
            {
                product_name: 'Kopi',
                price: 10000,
                quantity: 1,
                subtotal: 10000,
                note: null,
            },
        ],
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

describe('offlineQueue', () => {
    beforeEach(clearDatabase);

    it('enqueue menyimpan transaksi status pending', async () => {
        const item = await enqueue('11111111-1111-4111-8111-111111111111');
        expect(item.status).toBe('pending');
        expect(item.error).toBeNull();
        expect(item.server_invoice).toBeNull();

        const all = await listTransactions();
        expect(all).toHaveLength(1);
        expect(all[0].client_uuid).toBe(
            '11111111-1111-4111-8111-111111111111',
        );
    });

    it('list terurut berdasarkan waktu dibuat', async () => {
        await enqueue('a');
        await new Promise((r) => setTimeout(r, 5));
        await enqueue('b');
        const all = await listTransactions();
        expect(all.map((i) => i.client_uuid)).toEqual(['a', 'b']);
    });

    it('update mengubah status & pesan error', async () => {
        await enqueue('c');
        const updated = await updateTransaction('c', {
            status: 'failed',
            error: 'Stok tidak cukup',
        });
        expect(updated?.status).toBe('failed');
        expect(updated?.error).toBe('Stok tidak cukup');
    });

    it('update pada uuid tak ada → null', async () => {
        expect(await updateTransaction('zzz', { status: 'synced' })).toBeNull();
    });

    it('remove menghapus dari antrean', async () => {
        await enqueue('d');
        await removeTransaction('d');
        expect(await listTransactions()).toHaveLength(0);
    });

    it('countByStatus menghitung per status', async () => {
        await enqueue('e');
        await enqueue('f');
        await enqueue('g');
        await updateTransaction('f', { status: 'failed', error: 'x' });
        await updateTransaction('g', { status: 'synced' });

        const counts = await countByStatus();
        expect(counts.pending).toBe(1);
        expect(counts.failed).toBe(1);
        expect(counts.synced).toBe(1);
    });

    it('purge menghapus synced yang sudah melewati retensi', async () => {
        await enqueue('old');
        await enqueue('recent');
        await updateTransaction('old', { status: 'synced' });
        await updateTransaction('recent', { status: 'synced' });

        // Retensi 0 dgn now = jauh di masa depan → 'old' terhapus,
        // 'recent' tetap? Keduanya synced → dgn retensi 0 semua terhapus.
        await purgeSyncedTransactions(0, Date.now() + 1000);
        expect(await listTransactions()).toHaveLength(0);
    });

    it('purge tidak menghapus transaksi pending/failed', async () => {
        await enqueue('p');
        await enqueue('q');
        await updateTransaction('q', { status: 'failed', error: 'x' });

        await purgeSyncedTransactions(0, Date.now() + 100000);
        const all = await listTransactions();
        expect(all).toHaveLength(2);
    });
});
