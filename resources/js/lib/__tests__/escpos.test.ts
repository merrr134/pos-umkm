import { ReceiptProfile, ReceiptTransaction } from '@/Pages/Kasir/kasir';
import { describe, expect, it } from 'vitest';
import {
    encodeReceipt,
    encodeTestPrint,
    EscPosEncoder,
    LINE_WIDTH,
    wrapText,
} from '../escpos';

/** Ubah bytes menjadi string mentah untuk asersi isi teks. */
function toRaw(bytes: Uint8Array): string {
    return String.fromCharCode(...bytes);
}

const profile: ReceiptProfile = {
    name: 'Pitou Cafe',
    logo: null,
    address: 'Jl. Kopi No. 1',
    phone: '0812-3456-7890',
    footer: 'Terima kasih, sampai jumpa lagi!',
};

function makeReceipt(
    overrides: Partial<ReceiptTransaction> = {},
): ReceiptTransaction {
    return {
        id: 1,
        invoice_number: 'TRX-20260717-0001',
        date: '2026-07-17T10:30:00+07:00',
        kasir: 'Budi',
        items: [
            {
                product_name: 'Es Kopi Susu',
                price: 18000,
                quantity: 2,
                subtotal: 36000,
                note: 'es sedikit',
            },
        ],
        subtotal: 36000,
        discount: 0,
        tax_name: null,
        tax_percent: 0,
        tax_amount: 0,
        rounding: 0,
        total: 36000,
        payment_method: 'tunai',
        payment_method_label: 'Tunai',
        paid_amount: 50000,
        change_amount: 14000,
        customer_phone: null,
        ...overrides,
    };
}

describe('EscPosEncoder — perintah dasar', () => {
    it('init menghasilkan ESC @', () => {
        expect([...new EscPosEncoder().init().encode()]).toEqual([0x1b, 0x40]);
    });

    it('align left/center menghasilkan ESC a n', () => {
        expect([...new EscPosEncoder().alignLeft().encode()]).toEqual([
            0x1b, 0x61, 0x00,
        ]);
        expect([...new EscPosEncoder().alignCenter().encode()]).toEqual([
            0x1b, 0x61, 0x01,
        ]);
    });

    it('bold on/off menghasilkan ESC E n', () => {
        expect([...new EscPosEncoder().bold(true).encode()]).toEqual([
            0x1b, 0x45, 0x01,
        ]);
        expect([...new EscPosEncoder().bold(false).encode()]).toEqual([
            0x1b, 0x45, 0x00,
        ]);
    });

    it('separator selebar 32 kolom', () => {
        const raw = toRaw(new EscPosEncoder().separator().encode());
        expect(raw).toBe('-'.repeat(LINE_WIDTH) + '\n');
    });

    it('feed menghasilkan ESC d n', () => {
        expect([...new EscPosEncoder().feed(3).encode()]).toEqual([
            0x1b, 0x64, 0x03,
        ]);
    });

    it('cut menghasilkan GS V (partial cut)', () => {
        expect([...new EscPosEncoder().cut().encode()]).toEqual([
            0x1d, 0x56, 0x42, 0x00,
        ]);
    });

    it('row meratakan nilai ke kanan pada lebar 32', () => {
        const raw = toRaw(new EscPosEncoder().row('Subtotal', '36.000').encode());
        const line = raw.slice(0, -1);
        expect(line).toHaveLength(LINE_WIDTH);
        expect(line.startsWith('Subtotal')).toBe(true);
        expect(line.endsWith('36.000')).toBe(true);
    });

    it('karakter non-ASCII diganti tanda tanya', () => {
        const raw = toRaw(new EscPosEncoder().text('Café ☕').encode());
        expect(raw).toBe('Caf? ?');
    });
});

describe('wrapText', () => {
    it('membungkus per kata sesuai lebar', () => {
        expect(wrapText('kopi susu gula aren enak sekali rasanya', 12)).toEqual(
            ['kopi susu', 'gula aren', 'enak sekali', 'rasanya'],
        );
    });

    it('memotong kata yang lebih panjang dari lebar', () => {
        expect(wrapText('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    });

    it('teks kosong tetap satu baris kosong', () => {
        expect(wrapText('', 10)).toEqual(['']);
    });
});

describe('encodeReceipt — format sama dengan struk browser', () => {
    it('memuat header toko, info transaksi, item, dan total', () => {
        const raw = toRaw(encodeReceipt(makeReceipt(), profile));

        expect(raw).toContain('Pitou Cafe');
        expect(raw).toContain('Telp: 0812-3456-7890');
        expect(raw).toContain('Jl. Kopi No. 1');
        expect(raw).toContain('TRX-20260717-0001');
        expect(raw).toContain('Budi');
        expect(raw).toContain('Es Kopi Susu');
        expect(raw).toContain('* es sedikit');
        expect(raw).toContain('2 x 18.000');
        expect(raw).toContain('36.000');
        expect(raw).toContain('TOTAL');
        expect(raw).toContain('Bayar (Tunai)');
        expect(raw).toContain('50.000');
        expect(raw).toContain('Kembalian');
        expect(raw).toContain('14.000');
        expect(raw).toContain('Terima kasih, sampai jumpa lagi!');
    });

    it('baris pajak tidak muncul saat pajak OFF (tax_name null)', () => {
        const raw = toRaw(encodeReceipt(makeReceipt(), profile));
        expect(raw).not.toContain('%');
    });

    it('baris pajak muncul dengan nama & persen saat pajak ON', () => {
        const raw = toRaw(
            encodeReceipt(
                makeReceipt({
                    tax_name: 'PPN',
                    tax_percent: 10,
                    tax_amount: 3600,
                    total: 39600,
                }),
                profile,
            ),
        );
        expect(raw).toContain('PPN (10%)');
        expect(raw).toContain('3.600');
    });

    it('diskon hanya muncul jika > 0, dengan tanda minus', () => {
        const without = toRaw(encodeReceipt(makeReceipt(), profile));
        expect(without).not.toContain('Diskon');

        const withDiscount = toRaw(
            encodeReceipt(
                makeReceipt({ discount: 5000, total: 31000 }),
                profile,
            ),
        );
        expect(withDiscount).toContain('Diskon');
        expect(withDiscount).toContain('-5.000');
    });

    it('kembalian tidak muncul untuk non-tunai', () => {
        const raw = toRaw(
            encodeReceipt(
                makeReceipt({
                    payment_method: 'qris',
                    payment_method_label: 'QRIS',
                    paid_amount: null,
                    change_amount: null,
                }),
                profile,
            ),
        );
        expect(raw).not.toContain('Kembalian');
        expect(raw).toContain('Bayar (QRIS)');
    });

    it('diakhiri feed + cut agar kertas keluar', () => {
        const bytes = [...encodeReceipt(makeReceipt(), profile)];
        expect(bytes.slice(-4)).toEqual([0x1d, 0x56, 0x42, 0x00]); // cut
        expect(bytes.slice(-7, -4)).toEqual([0x1b, 0x64, 0x03]); // feed 3
    });

    it('footer tidak muncul jika Profil Toko tanpa footer', () => {
        const raw = toRaw(
            encodeReceipt(makeReceipt(), { ...profile, footer: null }),
        );
        expect(raw).not.toContain('Terima kasih');
    });
});

describe('encodeTestPrint', () => {
    it('memuat nama toko dan teks tes cetak', () => {
        const raw = toRaw(encodeTestPrint('Pitou Cafe'));
        expect(raw).toContain('Pitou Cafe');
        expect(raw).toContain('Tes cetak berhasil');
    });
});
