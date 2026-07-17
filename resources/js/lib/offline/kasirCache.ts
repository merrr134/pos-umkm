import {
    ActivePaymentMethod,
    KasirProduct,
    ReceiptProfile,
    TaxSettings,
} from '@/Pages/Kasir/kasir';
import { Category } from '@/types';
import { idbGet, idbPut, STORE_KASIR } from './db';

/**
 * Cache snapshot layar Kasir di IndexedDB (Fase 15 — PRD 5.14):
 * produk & kategori (+ metode bayar, pajak, profil struk) sehingga
 * halaman Kasir tetap berfungsi penuh saat offline.
 */

const SNAPSHOT_KEY = 'snapshot';

export interface KasirSnapshot {
    products: KasirProduct[];
    categories: Category[];
    paymentMethods: ActivePaymentMethod[];
    taxSettings: TaxSettings;
    receiptProfile: ReceiptProfile;
    cached_at: string;
}

export async function saveKasirSnapshot(
    snapshot: KasirSnapshot,
): Promise<void> {
    await idbPut(STORE_KASIR, snapshot, SNAPSHOT_KEY);
}

export async function loadKasirSnapshot(): Promise<KasirSnapshot | null> {
    const snapshot = await idbGet<KasirSnapshot>(STORE_KASIR, SNAPSHOT_KEY);
    return snapshot ?? null;
}

/**
 * Kurangi stok lokal setelah transaksi offline — supaya transaksi
 * offline berikutnya melihat sisa stok terkini (server tetap sumber
 * kebenaran saat sinkronisasi; ini hanya penjaga di sisi client).
 */
export async function decrementSnapshotStock(
    items: { product_id: number; quantity: number }[],
): Promise<KasirSnapshot | null> {
    const snapshot = await loadKasirSnapshot();
    if (snapshot === null) return null;

    const quantities = new Map(
        items.map((item) => [item.product_id, item.quantity]),
    );

    snapshot.products = snapshot.products.map((product) => {
        const sold = quantities.get(product.id);
        if (!sold || !product.track_stock) return product;

        const stock = Math.max(0, product.stock - sold);
        return {
            ...product,
            stock,
            sellable: product.status === 'aktif' && stock > 0,
        };
    });

    await saveKasirSnapshot(snapshot);
    return snapshot;
}
