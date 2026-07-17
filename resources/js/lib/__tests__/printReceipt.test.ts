import { ReceiptProfile, ReceiptTransaction } from '@/Pages/Kasir/kasir';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BluetoothPrinterService,
    PrinterError,
    PRINTER_ERROR_MESSAGES,
} from '../printerService';
import { printReceipt } from '../printReceipt';

/**
 * Test fallback print browser (Fase 14 — PRD Bab 9): Bluetooth gagal
 * dengan alasan apa pun → window.print() dipanggil otomatis, dan
 * printReceipt tidak pernah melempar error sehingga alur penyelesaian
 * transaksi (data sudah tersimpan) tidak pernah terganggu.
 */

const profile: ReceiptProfile = {
    name: 'Pitou Cafe',
    logo: null,
    address: null,
    phone: null,
    footer: null,
};

const receipt: ReceiptTransaction = {
    id: 1,
    invoice_number: 'TRX-20260717-0001',
    date: '2026-07-17T10:30:00+07:00',
    kasir: 'Budi',
    items: [
        {
            product_name: 'Es Kopi Susu',
            price: 18000,
            quantity: 1,
            subtotal: 18000,
            note: null,
        },
    ],
    subtotal: 18000,
    discount: 0,
    tax_name: null,
    tax_percent: 0,
    tax_amount: 0,
    rounding: 0,
    total: 18000,
    payment_method: 'tunai',
    payment_method_label: 'Tunai',
    paid_amount: 20000,
    change_amount: 2000,
    customer_phone: null,
};

function fakeService(overrides: {
    supported: boolean;
    connected: boolean;
    printError?: Error;
}): { service: BluetoothPrinterService; print: ReturnType<typeof vi.fn> } {
    const print = vi.fn(async (_data: Uint8Array) => {
        void _data;
        if (overrides.printError) throw overrides.printError;
    });
    const service = {
        isSupported: () => overrides.supported,
        isConnected: () => overrides.connected,
        print,
    } as unknown as BluetoothPrinterService;
    return { service, print };
}

let printMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    printMock = vi.fn();
    (globalThis as { window?: unknown }).window = { print: printMock };
});

afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
});

describe('printReceipt — jalur Bluetooth', () => {
    it('printer terhubung → cetak via Bluetooth, tanpa print browser', async () => {
        const { service, print } = fakeService({
            supported: true,
            connected: true,
        });

        const result = await printReceipt(receipt, profile, service);

        expect(result).toEqual({
            via: 'bluetooth',
            ok: true,
            fallbackReason: null,
        });
        expect(print).toHaveBeenCalledTimes(1);
        expect(print.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
        expect(printMock).not.toHaveBeenCalled();
    });
});

describe('printReceipt — fallback otomatis ke print browser', () => {
    it('browser tidak mendukung Web Bluetooth → print browser + alasan', async () => {
        const { service } = fakeService({ supported: false, connected: false });

        const result = await printReceipt(receipt, profile, service);

        expect(result.via).toBe('browser');
        expect(result.ok).toBe(true);
        expect(result.fallbackReason).toBe(PRINTER_ERROR_MESSAGES.unsupported);
        expect(printMock).toHaveBeenCalledTimes(1);
    });

    it('printer belum terhubung → langsung print browser tanpa pesan', async () => {
        const { service } = fakeService({ supported: true, connected: false });

        const result = await printReceipt(receipt, profile, service);

        expect(result).toEqual({
            via: 'browser',
            ok: true,
            fallbackReason: null,
        });
        expect(printMock).toHaveBeenCalledTimes(1);
    });

    it('printer terputus saat cetak → fallback + alasan jelas', async () => {
        const { service } = fakeService({
            supported: true,
            connected: true,
            printError: new PrinterError('disconnected'),
        });

        const result = await printReceipt(receipt, profile, service);

        expect(result.via).toBe('browser');
        expect(result.fallbackReason).toBe(
            PRINTER_ERROR_MESSAGES.disconnected,
        );
        expect(printMock).toHaveBeenCalledTimes(1);
    });

    it('timeout kirim data → fallback + alasan timeout', async () => {
        const { service } = fakeService({
            supported: true,
            connected: true,
            printError: new PrinterError('timeout'),
        });

        const result = await printReceipt(receipt, profile, service);

        expect(result.fallbackReason).toBe(PRINTER_ERROR_MESSAGES.timeout);
        expect(printMock).toHaveBeenCalledTimes(1);
    });

    it('error tak dikenal → tetap fallback dengan pesan umum', async () => {
        const { service } = fakeService({
            supported: true,
            connected: true,
            printError: new Error('boom'),
        });

        const result = await printReceipt(receipt, profile, service);

        expect(result.via).toBe('browser');
        expect(result.fallbackReason).toBe(
            PRINTER_ERROR_MESSAGES['write-failed'],
        );
        expect(printMock).toHaveBeenCalledTimes(1);
    });
});

describe('printReceipt — transaksi tetap aman', () => {
    it('tidak pernah melempar error meski Bluetooth DAN browser gagal', async () => {
        const { service } = fakeService({
            supported: true,
            connected: true,
            printError: new PrinterError('write-failed'),
        });
        printMock.mockImplementation(() => {
            throw new Error('print dialog gagal');
        });

        // Tanpa throw → alur setelah transaksi tersimpan tidak terganggu
        const result = await printReceipt(receipt, profile, service);

        expect(result.via).toBe('browser');
        expect(result.ok).toBe(false);
        expect(result.fallbackReason).toBe(
            PRINTER_ERROR_MESSAGES['write-failed'],
        );
    });

    it('data struk tidak diubah oleh proses cetak', async () => {
        const snapshot = JSON.parse(JSON.stringify(receipt));
        const { service } = fakeService({
            supported: true,
            connected: true,
            printError: new PrinterError('disconnected'),
        });

        await printReceipt(receipt, profile, service);

        expect(receipt).toEqual(snapshot);
    });
});
