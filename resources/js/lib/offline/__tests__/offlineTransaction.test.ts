import {
    CartItem,
    KasirProduct,
    TaxSettings,
} from '@/Pages/Kasir/kasir';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDbForTests } from '../db';
import { loadKasirSnapshot, saveKasirSnapshot } from '../kasirCache';
import { listTransactions } from '../offlineQueue';
import {
    createOfflineTransaction,
    generateClientUuid,
    isOfflineReceipt,
    OFFLINE_INVOICE_PREFIX,
} from '../offlineTransaction';

async function clearDatabase(): Promise<void> {
    resetDbForTests();
    await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('pitou-pos-offline');
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
    });
}

function makeProduct(overrides: Partial<KasirProduct> = {}): KasirProduct {
    return {
        id: 1,
        name: 'Es Kopi Susu',
        price: 18000,
        photo_url: null,
        category_id: 2,
        status: 'aktif',
        track_stock: true,
        stock: 10,
        sellable: true,
        ...overrides,
    };
}

function cartOf(product: KasirProduct, qty: number, note = ''): CartItem {
    return { product, qty, note };
}

const taxOff: TaxSettings = {
    enabled: false,
    name: 'Pajak',
    percent: 0,
    rounding_method: 'none',
};

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateClientUuid', () => {
    it('menghasilkan UUID v4 valid', () => {
        expect(generateClientUuid()).toMatch(UUID_RE);
    });

    it('setiap panggilan unik', () => {
        const a = generateClientUuid();
        const b = generateClientUuid();
        expect(a).not.toBe(b);
    });
});

describe('createOfflineTransaction', () => {
    beforeEach(clearDatabase);

    it('menyimpan transaksi ke antrean dgn client_uuid & status pending', async () => {
        const product = makeProduct();
        const receipt = await createOfflineTransaction({
            cart: [cartOf(product, 2, 'es sedikit')],
            discountType: 'nominal',
            discountValue: '',
            subtotal: 36000,
            discount: 0,
            tax: 0,
            rounding: 0,
            total: 36000,
            taxSettings: taxOff,
            methodCode: 'tunai',
            methodLabel: 'Tunai',
            paidAmount: 50000,
            customerPhone: null,
            kasirName: 'Budi',
        });

        expect(isOfflineReceipt(receipt)).toBe(true);
        expect(receipt.invoice_number.startsWith(OFFLINE_INVOICE_PREFIX)).toBe(
            true,
        );
        expect(receipt.total).toBe(36000);
        expect(receipt.change_amount).toBe(14000);
        expect(receipt.items[0].note).toBe('es sedikit');

        const queue = await listTransactions();
        expect(queue).toHaveLength(1);
        expect(queue[0].status).toBe('pending');
        expect(queue[0].payload.client_uuid).toMatch(UUID_RE);
        expect(queue[0].payload.payment_method).toBe('tunai');
        expect(queue[0].payload.paid_amount).toBe(50000);
        // Payload item hanya mengirim id+qty+note (harga dihitung server)
        expect(queue[0].payload.items).toEqual([
            { product_id: 1, quantity: 2, note: 'es sedikit' },
        ]);
    });

    it('non-tunai → paid_amount & change null', async () => {
        const receipt = await createOfflineTransaction({
            cart: [cartOf(makeProduct(), 1)],
            discountType: 'nominal',
            discountValue: '',
            subtotal: 18000,
            discount: 0,
            tax: 0,
            rounding: 0,
            total: 18000,
            taxSettings: taxOff,
            methodCode: 'qris',
            methodLabel: 'QRIS',
            paidAmount: null,
            customerPhone: null,
            kasirName: 'Budi',
        });

        expect(receipt.paid_amount).toBeNull();
        expect(receipt.change_amount).toBeNull();
        const queue = await listTransactions();
        expect(queue[0].payload.paid_amount).toBeNull();
    });

    it('mengurangi stok pada snapshot lokal (produk track_stock)', async () => {
        const product = makeProduct({ stock: 10 });
        await saveKasirSnapshot({
            products: [product],
            categories: [],
            paymentMethods: [],
            taxSettings: taxOff,
            receiptProfile: {
                name: 'Pitou Cafe',
                logo: null,
                address: null,
                phone: null,
                footer: null,
            },
            cached_at: new Date().toISOString(),
        });

        await createOfflineTransaction({
            cart: [cartOf(product, 3)],
            discountType: 'nominal',
            discountValue: '',
            subtotal: 54000,
            discount: 0,
            tax: 0,
            rounding: 0,
            total: 54000,
            taxSettings: taxOff,
            methodCode: 'tunai',
            methodLabel: 'Tunai',
            paidAmount: 54000,
            customerPhone: null,
            kasirName: 'Budi',
        });

        const snapshot = await loadKasirSnapshot();
        expect(snapshot?.products[0].stock).toBe(7);
        expect(snapshot?.products[0].sellable).toBe(true);
    });

    it('stok habis di snapshot → produk jadi tidak sellable', async () => {
        const product = makeProduct({ stock: 2 });
        await saveKasirSnapshot({
            products: [product],
            categories: [],
            paymentMethods: [],
            taxSettings: taxOff,
            receiptProfile: {
                name: 'Pitou Cafe',
                logo: null,
                address: null,
                phone: null,
                footer: null,
            },
            cached_at: new Date().toISOString(),
        });

        await createOfflineTransaction({
            cart: [cartOf(product, 2)],
            discountType: 'nominal',
            discountValue: '',
            subtotal: 36000,
            discount: 0,
            tax: 0,
            rounding: 0,
            total: 36000,
            taxSettings: taxOff,
            methodCode: 'tunai',
            methodLabel: 'Tunai',
            paidAmount: 36000,
            customerPhone: null,
            kasirName: 'Budi',
        });

        const snapshot = await loadKasirSnapshot();
        expect(snapshot?.products[0].stock).toBe(0);
        expect(snapshot?.products[0].sellable).toBe(false);
    });
});
