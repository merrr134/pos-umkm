import { beforeEach, describe, expect, it } from 'vitest';
import {
    idbDelete,
    idbGet,
    idbGetAll,
    idbPut,
    isIndexedDbAvailable,
    openDb,
    resetDbForTests,
    STORE_KASIR,
    STORE_QUEUE,
} from '../db';

async function clearDatabase(): Promise<void> {
    resetDbForTests();
    await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('pitou-pos-offline');
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
    });
}

describe('IndexedDB wrapper (db.ts)', () => {
    beforeEach(clearDatabase);

    it('IndexedDB tersedia di environment test (fake-indexeddb)', () => {
        expect(isIndexedDbAvailable()).toBe(true);
    });

    it('membuka database dengan kedua object store', async () => {
        const db = await openDb();
        expect(db.objectStoreNames.contains(STORE_KASIR)).toBe(true);
        expect(db.objectStoreNames.contains(STORE_QUEUE)).toBe(true);
    });

    it('put + get pada store kasir (dengan key eksplisit)', async () => {
        await idbPut(STORE_KASIR, { hello: 'dunia' }, 'snapshot');
        const value = await idbGet<{ hello: string }>(STORE_KASIR, 'snapshot');
        expect(value).toEqual({ hello: 'dunia' });
    });

    it('put memakai keyPath client_uuid pada store queue', async () => {
        await idbPut(STORE_QUEUE, { client_uuid: 'abc', total: 100 });
        const value = await idbGet<{ total: number }>(STORE_QUEUE, 'abc');
        expect(value?.total).toBe(100);
    });

    it('getAll mengembalikan seluruh isi store', async () => {
        await idbPut(STORE_QUEUE, { client_uuid: 'a' });
        await idbPut(STORE_QUEUE, { client_uuid: 'b' });
        const all = await idbGetAll<{ client_uuid: string }>(STORE_QUEUE);
        expect(all).toHaveLength(2);
    });

    it('delete menghapus entri', async () => {
        await idbPut(STORE_QUEUE, { client_uuid: 'x' });
        await idbDelete(STORE_QUEUE, 'x');
        expect(await idbGet(STORE_QUEUE, 'x')).toBeUndefined();
    });

    it('get pada key tak ada → undefined', async () => {
        expect(await idbGet(STORE_KASIR, 'tidak-ada')).toBeUndefined();
    });
});
