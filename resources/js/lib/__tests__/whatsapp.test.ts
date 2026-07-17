import { ReceiptTransaction } from '@/Pages/Kasir/kasir';
import { describe, expect, it } from 'vitest';
import {
    buildReceiptMessage,
    buildReceiptWaLink,
    buildWaLink,
    isValidPhone,
    normalizePhone,
} from '../whatsapp';

function makeReceipt(
    overrides: Partial<ReceiptTransaction> = {},
): ReceiptTransaction {
    return {
        id: 1,
        invoice_number: 'TRX-20260718-0001',
        date: '2026-07-18T10:30:00+07:00',
        kasir: 'Budi',
        items: [
            {
                product_name: 'Es Kopi Susu',
                price: 18000,
                quantity: 2,
                subtotal: 36000,
                note: null,
            },
            {
                product_name: 'Roti Bakar',
                price: 15000,
                quantity: 1,
                subtotal: 15000,
                note: null,
            },
        ],
        subtotal: 51000,
        discount: 0,
        tax_name: null,
        tax_percent: 0,
        tax_amount: 0,
        rounding: 0,
        total: 51000,
        payment_method: 'qris',
        payment_method_label: 'QRIS',
        paid_amount: null,
        change_amount: null,
        customer_phone: '081234567890',
        ...overrides,
    };
}

describe('normalizePhone (08… → 628…)', () => {
    it('awalan 0 → 62', () => {
        expect(normalizePhone('081234567890')).toBe('6281234567890');
    });

    it('sudah 62 → tetap', () => {
        expect(normalizePhone('6281234567890')).toBe('6281234567890');
    });

    it('awalan 8 → tambah 62', () => {
        expect(normalizePhone('81234567890')).toBe('6281234567890');
    });

    it('membuang spasi, tanda hubung, dan +', () => {
        expect(normalizePhone('+62 812-3456-7890')).toBe('6281234567890');
        expect(normalizePhone('0812 3456 7890')).toBe('6281234567890');
    });

    it('kosong / null / undefined → string kosong', () => {
        expect(normalizePhone('')).toBe('');
        expect(normalizePhone(null)).toBe('');
        expect(normalizePhone(undefined)).toBe('');
    });
});

describe('isValidPhone', () => {
    it('nomor Indonesia normal → valid', () => {
        expect(isValidPhone('081234567890')).toBe(true);
        expect(isValidPhone('6281234567890')).toBe(true);
        expect(isValidPhone('81234567890')).toBe(true);
    });

    it('terlalu pendek → tidak valid', () => {
        expect(isValidPhone('0812')).toBe(false);
    });

    it('kosong → tidak valid', () => {
        expect(isValidPhone('')).toBe(false);
        expect(isValidPhone(null)).toBe(false);
    });
});

describe('buildReceiptMessage — format PRD Fase 16', () => {
    const message = buildReceiptMessage(makeReceipt(), 'Pitou Cafe');

    it('memuat salam & nama toko', () => {
        expect(message).toContain('Halo 👋');
        expect(message).toContain('Terima kasih telah berbelanja di Pitou Cafe');
    });

    it('memuat nomor transaksi & label', () => {
        expect(message).toContain('No Transaksi:');
        expect(message).toContain('TRX-20260718-0001');
    });

    it('memuat daftar item dalam format "- Nama xQty"', () => {
        expect(message).toContain('- Es Kopi Susu x2');
        expect(message).toContain('- Roti Bakar x1');
    });

    it('memuat total berformat Rupiah', () => {
        expect(message).toContain('Total:');
        expect(message).toContain('Rp 51.000');
    });

    it('memuat metode pembayaran & penutup', () => {
        expect(message).toContain('Metode:');
        expect(message).toContain('QRIS');
        expect(message).toContain('Terima kasih 🙏');
    });
});

describe('buildWaLink', () => {
    it('nomor valid → tautan wa.me dengan teks ter-encode', () => {
        const link = buildWaLink('081234567890', 'Halo dunia & selamat');
        expect(link).not.toBeNull();
        expect(link!.startsWith('https://wa.me/6281234567890?text=')).toBe(
            true,
        );
        // Spasi & ampersand harus ter-encode
        expect(link).toContain('Halo%20dunia%20%26%20selamat');
    });

    it('nomor tidak valid → null', () => {
        expect(buildWaLink('0812', 'x')).toBeNull();
        expect(buildWaLink('', 'x')).toBeNull();
    });
});

describe('buildReceiptWaLink', () => {
    it('menggabungkan pesan struk + nomor pelanggan', () => {
        const link = buildReceiptWaLink(makeReceipt(), 'Pitou Cafe');
        expect(link).not.toBeNull();
        expect(link!.startsWith('https://wa.me/6281234567890?text=')).toBe(
            true,
        );
        expect(decodeURIComponent(link!)).toContain('Es Kopi Susu x2');
    });

    it('tanpa nomor pelanggan → null', () => {
        const link = buildReceiptWaLink(
            makeReceipt({ customer_phone: null }),
            'Pitou Cafe',
        );
        expect(link).toBeNull();
    });
});
