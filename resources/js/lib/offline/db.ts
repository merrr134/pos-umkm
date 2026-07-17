/**
 * Wrapper IndexedDB (Fase 15 — PRD 5.14) — tanpa dependency runtime.
 *
 * Dua object store:
 * - `kasir` : snapshot data layar Kasir (produk, kategori, dst)
 * - `queue` : antrean transaksi offline (keyPath client_uuid)
 *
 * Semua kegagalan (IndexedDB tidak tersedia / gagal dibuka) dilempar
 * sebagai Error berpesan Bahasa Indonesia — pemanggil menangkapnya dan
 * menampilkan toast, aplikasi tidak boleh crash (PRD Bab 9).
 */

const DB_NAME = 'pitou-pos-offline';
const DB_VERSION = 1;

export const STORE_KASIR = 'kasir';
export const STORE_QUEUE = 'queue';

export const IDB_UNAVAILABLE_MESSAGE =
    'Penyimpanan offline (IndexedDB) tidak tersedia di browser ini. Mode offline tidak dapat digunakan.';
export const IDB_OPEN_FAILED_MESSAGE =
    'Gagal membuka penyimpanan offline. Coba muat ulang halaman.';

let dbPromise: Promise<IDBDatabase> | null = null;
let dbInstance: IDBDatabase | null = null;

export function isIndexedDbAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
}

/**
 * Tutup koneksi & reset cache — dipakai unit test antar kasus agar
 * deleteDatabase tidak terblokir oleh koneksi yang masih terbuka.
 */
export function resetDbForTests(): void {
    if (dbInstance !== null) {
        dbInstance.close();
        dbInstance = null;
    }
    dbPromise = null;
}

export function openDb(): Promise<IDBDatabase> {
    if (!isIndexedDbAvailable()) {
        return Promise.reject(new Error(IDB_UNAVAILABLE_MESSAGE));
    }

    if (dbPromise === null) {
        dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_KASIR)) {
                    db.createObjectStore(STORE_KASIR);
                }
                if (!db.objectStoreNames.contains(STORE_QUEUE)) {
                    db.createObjectStore(STORE_QUEUE, {
                        keyPath: 'client_uuid',
                    });
                }
            };

            request.onsuccess = () => {
                dbInstance = request.result;
                // Server minta versi baru dari tab lain → tutup agar
                // upgrade tidak terblokir
                dbInstance.onversionchange = () => {
                    dbInstance?.close();
                    dbInstance = null;
                    dbPromise = null;
                };
                resolve(request.result);
            };
            request.onerror = () => {
                dbPromise = null; // izinkan percobaan ulang berikutnya
                reject(new Error(IDB_OPEN_FAILED_MESSAGE));
            };
            request.onblocked = () => {
                dbPromise = null;
                reject(new Error(IDB_OPEN_FAILED_MESSAGE));
            };
        });
    }

    return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
            reject(request.error ?? new Error(IDB_OPEN_FAILED_MESSAGE));
    });
}

export async function idbGet<T>(
    store: string,
    key: IDBValidKey,
): Promise<T | undefined> {
    const db = await openDb();
    return requestToPromise(
        db.transaction(store, 'readonly').objectStore(store).get(key),
    ) as Promise<T | undefined>;
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
    const db = await openDb();
    return requestToPromise(
        db.transaction(store, 'readonly').objectStore(store).getAll(),
    ) as Promise<T[]>;
}

export async function idbPut(
    store: string,
    value: unknown,
    key?: IDBValidKey,
): Promise<void> {
    const db = await openDb();
    await requestToPromise(
        db.transaction(store, 'readwrite').objectStore(store).put(value, key),
    );
}

export async function idbDelete(
    store: string,
    key: IDBValidKey,
): Promise<void> {
    const db = await openDb();
    await requestToPromise(
        db.transaction(store, 'readwrite').objectStore(store).delete(key),
    );
}
