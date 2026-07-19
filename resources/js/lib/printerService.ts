/**
 * Service printer Bluetooth (Fase 14 — PRD 5.5, Bab 9).
 *
 * Seluruh logika Web Bluetooth berada di sini, di luar komponen React.
 * UI memantau status lewat subscribe() (dipakai hook usePrinter).
 * Semua kegagalan dilempar sebagai PrinterError dengan pesan Bahasa
 * Indonesia yang jelas — pemanggil (printReceipt) menangkapnya untuk
 * fallback ke print browser.
 */

import { Capacitor } from '@capacitor/core';
import { nativePrinterService } from './nativePrinterService';

export type PrinterStatus = 'disconnected' | 'connecting' | 'connected';

/**
 * Antarmuka bersama service printer. Diimplementasikan oleh dua jalur:
 * BluetoothPrinterService (Web Bluetooth, browser desktop) dan
 * NativeBluetoothPrinterService (Bluetooth Classic SPP, Android/APK).
 * Pemanggil (printReceipt/usePrinter/PrinterPanel) cukup tahu antarmuka
 * ini sehingga jalur cetak tidak berubah antar platform.
 */
export interface PrinterService {
    isSupported(): boolean;
    isConnected(): boolean;
    connect(): Promise<void>;
    disconnect(): void;
    print(data: Uint8Array): Promise<void>;
    subscribe(listener: (status: PrinterStatus) => void): () => void;
    getStatus(): PrinterStatus;
    getDeviceName(): string | null;
}

export type PrinterErrorCode =
    | 'unsupported'
    | 'permission-denied'
    | 'not-found'
    | 'disconnected'
    | 'timeout'
    | 'write-failed';

/** Pesan error per kondisi (PRD Bab 9 — jelas & actionable). */
export const PRINTER_ERROR_MESSAGES: Record<PrinterErrorCode, string> = {
    unsupported:
        'Browser ini tidak mendukung Web Bluetooth. Struk akan dicetak lewat browser.',
    'permission-denied':
        'Izin Bluetooth ditolak. Izinkan akses Bluetooth di browser untuk memakai printer.',
    'not-found':
        'Printer tidak ditemukan. Pastikan printer menyala dan dalam jangkauan.',
    disconnected:
        'Printer tidak terhubung. Hubungkan printer terlebih dahulu.',
    timeout: 'Koneksi printer melebihi batas waktu. Coba lagi.',
    'write-failed':
        'Gagal mengirim data ke printer. Periksa printer, lalu coba lagi.',
};

export class PrinterError extends Error {
    constructor(public readonly code: PrinterErrorCode) {
        super(PRINTER_ERROR_MESSAGES[code]);
        this.name = 'PrinterError';
    }
}

/**
 * Service UUID yang umum dipakai printer thermal Bluetooth LE.
 * requestDevice memakai acceptAllDevices + optionalServices agar
 * berbagai merek printer 58mm tetap bisa dipilih; characteristic
 * tulis dicari dinamis dari service yang tersedia.
 */
const PRINTER_SERVICE_UUIDS = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ae30-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

/** Ukuran potongan tulis — aman untuk MTU BLE berbagai printer. */
const WRITE_CHUNK_SIZE = 100;

interface PrinterServiceOptions {
    /** Sumber Web Bluetooth — bisa diganti mock saat testing. */
    getBluetooth?: () => Bluetooth | undefined;
    connectTimeoutMs?: number;
    writeTimeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new PrinterError('timeout')),
            ms,
        );
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (reason) => {
                clearTimeout(timer);
                reject(reason);
            },
        );
    });
}

export class BluetoothPrinterService implements PrinterService {
    private device: BluetoothDevice | null = null;
    private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
    private status: PrinterStatus = 'disconnected';
    private listeners = new Set<(status: PrinterStatus) => void>();
    private readonly getBluetooth: () => Bluetooth | undefined;
    private readonly connectTimeoutMs: number;
    private readonly writeTimeoutMs: number;
    private readonly onGattDisconnected = () => {
        this.characteristic = null;
        this.setStatus('disconnected');
    };

    constructor(options: PrinterServiceOptions = {}) {
        this.getBluetooth =
            options.getBluetooth ??
            (() =>
                typeof navigator !== 'undefined'
                    ? navigator.bluetooth
                    : undefined);
        this.connectTimeoutMs = options.connectTimeoutMs ?? 10000;
        this.writeTimeoutMs = options.writeTimeoutMs ?? 10000;
    }

    /** Apakah browser mendukung Web Bluetooth. */
    isSupported(): boolean {
        return this.getBluetooth() !== undefined;
    }

    isConnected(): boolean {
        return this.status === 'connected' && this.characteristic !== null;
    }

    getStatus(): PrinterStatus {
        return this.status;
    }

    /** Nama printer yang terhubung/terakhir dipilih (untuk UI). */
    getDeviceName(): string | null {
        return this.device?.name ?? null;
    }

    /** Pantau perubahan status; mengembalikan fungsi unsubscribe. */
    subscribe(listener: (status: PrinterStatus) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private setStatus(status: PrinterStatus): void {
        if (this.status === status) return;
        this.status = status;
        for (const listener of this.listeners) listener(status);
    }

    /**
     * Buka pemilih perangkat lalu sambungkan GATT. Harus dipanggil
     * dari user gesture (klik tombol Hubungkan Printer).
     */
    async connect(): Promise<void> {
        const bluetooth = this.getBluetooth();
        if (!bluetooth) throw new PrinterError('unsupported');

        this.setStatus('connecting');
        try {
            const device = await bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: PRINTER_SERVICE_UUIDS,
            });
            await this.connectDevice(device);
        } catch (error) {
            this.setStatus('disconnected');
            throw this.toPrinterError(error);
        }
    }

    /**
     * Sambung ulang ke printer terakhir tanpa membuka pemilih
     * perangkat; jika belum pernah memilih → connect() biasa.
     */
    async reconnect(): Promise<void> {
        if (!this.device) {
            return this.connect();
        }

        this.setStatus('connecting');
        try {
            await this.connectDevice(this.device);
        } catch (error) {
            this.setStatus('disconnected');
            throw this.toPrinterError(error);
        }
    }

    private async connectDevice(device: BluetoothDevice): Promise<void> {
        if (!device.gatt) throw new PrinterError('not-found');

        this.device?.removeEventListener(
            'gattserverdisconnected',
            this.onGattDisconnected,
        );
        this.device = device;
        device.addEventListener(
            'gattserverdisconnected',
            this.onGattDisconnected,
        );

        const server = await withTimeout(
            device.gatt.connect(),
            this.connectTimeoutMs,
        );
        this.characteristic = await withTimeout(
            this.findWritableCharacteristic(server),
            this.connectTimeoutMs,
        );
        this.setStatus('connected');
    }

    /** Cari characteristic pertama yang bisa ditulisi data cetak. */
    private async findWritableCharacteristic(
        server: BluetoothRemoteGATTServer,
    ): Promise<BluetoothRemoteGATTCharacteristic> {
        const services = await server.getPrimaryServices();
        for (const service of services) {
            const characteristics = await service.getCharacteristics();
            for (const characteristic of characteristics) {
                if (
                    characteristic.properties.write ||
                    characteristic.properties.writeWithoutResponse
                ) {
                    return characteristic;
                }
            }
        }
        throw new PrinterError('not-found');
    }

    /** Putuskan koneksi; perangkat diingat agar bisa reconnect(). */
    disconnect(): void {
        this.characteristic = null;
        if (this.device?.gatt?.connected) {
            this.device.gatt.disconnect();
        }
        this.setStatus('disconnected');
    }

    /** Kirim bytes ESC/POS ke printer, dipotong per chunk BLE. */
    async print(data: Uint8Array): Promise<void> {
        const characteristic = this.characteristic;
        if (!this.isConnected() || !characteristic) {
            throw new PrinterError('disconnected');
        }

        try {
            for (
                let offset = 0;
                offset < data.length;
                offset += WRITE_CHUNK_SIZE
            ) {
                const chunk = data.slice(offset, offset + WRITE_CHUNK_SIZE);
                await withTimeout(
                    characteristic.properties.writeWithoutResponse
                        ? characteristic.writeValueWithoutResponse(chunk)
                        : characteristic.writeValue(chunk),
                    this.writeTimeoutMs,
                );
            }
        } catch (error) {
            if (error instanceof PrinterError) throw error;
            throw new PrinterError('write-failed');
        }
    }

    /** Petakan DOMException Web Bluetooth ke PrinterError. */
    private toPrinterError(error: unknown): PrinterError {
        if (error instanceof PrinterError) return error;

        if (error instanceof Error) {
            if (
                error.name === 'NotAllowedError' ||
                error.name === 'SecurityError'
            ) {
                return new PrinterError('permission-denied');
            }
            if (error.name === 'NotFoundError') {
                return new PrinterError('not-found');
            }
            if (error.name === 'NetworkError') {
                return new PrinterError('disconnected');
            }
        }

        return new PrinterError('not-found');
    }
}

/**
 * Instance tunggal — status printer bertahan antar halaman Inertia.
 * Di dalam APK (Capacitor native) memakai Bluetooth Classic SPP; di
 * browser desktop memakai Web Bluetooth. Import native ditaruh di sini
 * (akhir file) agar binding PrinterError sudah terinisialisasi.
 */
export const printerService: PrinterService = Capacitor.isNativePlatform()
    ? nativePrinterService
    : new BluetoothPrinterService();
