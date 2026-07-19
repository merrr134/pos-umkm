/**
 * Service printer Bluetooth Classic (SPP) untuk Android/Capacitor —
 * Fase 14 lanjutan.
 *
 * WebView Android tidak mendukung Web Bluetooth, dan printer thermal
 * 58mm (mis. Ainuo 58D) memakai Bluetooth Classic (bukan BLE). Service
 * ini memakai cordova-plugin-bluetooth-serial untuk mengirim byte
 * ESC/POS mentah (dari escpos.ts) ke printer yang sudah ter-pair.
 *
 * Antarmuka publiknya kompatibel dengan BluetoothPrinterService (Web
 * Bluetooth) sehingga printReceipt/PrintButton/usePrinter tidak
 * berubah; UI (PrinterPanel) memakai listDevices()/connectTo() untuk
 * memilih printer karena tidak ada dialog pemilih bawaan seperti di
 * browser.
 */

import { Capacitor } from '@capacitor/core';
import type { BluetoothSerialDevice } from '@/types/bluetooth-serial';
import {
    PrinterError,
    PrinterService,
    PrinterStatus,
} from './printerService';

/** Ukuran potongan tulis — printer thermal SPP kecil buffer-nya. */
const WRITE_CHUNK_SIZE = 256;
/** Jeda antar chunk agar buffer printer tidak overflow. */
const CHUNK_DELAY_MS = 20;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class NativeBluetoothPrinterService implements PrinterService {
    private status: PrinterStatus = 'disconnected';
    private deviceName: string | null = null;
    private deviceAddress: string | null = null;
    private listeners = new Set<(status: PrinterStatus) => void>();

    private get plugin() {
        return typeof window !== 'undefined' ? window.bluetoothSerial : undefined;
    }

    /** Tersedia hanya di platform native yang punya plugin. */
    isSupported(): boolean {
        return Capacitor.isNativePlatform() && this.plugin !== undefined;
    }

    isConnected(): boolean {
        return this.status === 'connected';
    }

    getStatus(): PrinterStatus {
        return this.status;
    }

    getDeviceName(): string | null {
        return this.deviceName;
    }

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
     * Minta izin Bluetooth runtime (Android 12+). Aman dipanggil di
     * versi Android lama / tanpa plugin izin — akan langsung lolos.
     */
    private async ensurePermissions(): Promise<void> {
        const perms = window.cordova?.plugins?.permissions;
        if (!perms) return;
        // Pakai string izin Android langsung — konstanta PERMISSION di
        // plugin belum tentu memuat izin Bluetooth baru (Android 12+),
        // dan tanpa BLUETOOTH_CONNECT, getBondedDevices() balik kosong.
        const P = perms.PERMISSION ?? {};
        const needed = [
            P.BLUETOOTH_CONNECT ?? 'android.permission.BLUETOOTH_CONNECT',
            P.BLUETOOTH_SCAN ?? 'android.permission.BLUETOOTH_SCAN',
        ];

        // Tampilkan dialog izin; lanjut apa pun hasilnya — bila ditolak,
        // listDevices() akan mengembalikan kosong dan UI memandunya.
        await new Promise<void>((resolve) => {
            perms.requestPermissions(
                needed,
                () => resolve(),
                () => resolve(),
            );
        });
    }

    /** Daftar printer/perangkat yang sudah ter-pair di sistem. */
    async listDevices(): Promise<BluetoothSerialDevice[]> {
        const plugin = this.plugin;
        if (!plugin) throw new PrinterError('unsupported');
        await this.ensurePermissions();
        return new Promise<BluetoothSerialDevice[]>((resolve, reject) => {
            plugin.list(
                (devices) => resolve(devices ?? []),
                () => reject(new PrinterError('not-found')),
            );
        });
    }

    /**
     * connect() tanpa argumen: sambung ulang ke printer terakhir; jika
     * belum ada, pilih otomatis bila hanya satu perangkat ter-pair.
     * UI biasanya memakai connectTo() lewat pemilih perangkat.
     */
    async connect(): Promise<void> {
        if (this.deviceAddress) {
            return this.connectTo(this.deviceAddress, this.deviceName);
        }
        const devices = await this.listDevices();
        if (devices.length === 0) throw new PrinterError('not-found');
        if (devices.length === 1) {
            return this.connectTo(devices[0].address, devices[0].name ?? null);
        }
        // Banyak perangkat → UI harus memanggil connectTo() dgn pilihan.
        throw new PrinterError('not-found');
    }

    /** Sambung ke printer tertentu (dipilih dari listDevices()). */
    async connectTo(address: string, name: string | null = null): Promise<void> {
        const plugin = this.plugin;
        if (!plugin) throw new PrinterError('unsupported');

        await this.ensurePermissions();
        this.setStatus('connecting');
        try {
            await this.openConnection(plugin, address);
            this.deviceAddress = address;
            this.deviceName = name;
            this.setStatus('connected');
        } catch (error) {
            this.setStatus('disconnected');
            throw error instanceof PrinterError
                ? error
                : new PrinterError('not-found');
        }
    }

    /**
     * Buka koneksi SPP. Callback sukses plugin dipanggil saat konek;
     * callback gagal dipanggil saat gagal konek ATAU saat koneksi
     * terputus kemudian — jadi setelah settle, itu berarti disconnect.
     * Coba mode aman dulu, lalu insecure (banyak printer murah butuh).
     */
    private openConnection(
        plugin: NonNullable<Window['bluetoothSerial']>,
        address: string,
    ): Promise<void> {
        const tryConnect = (insecure: boolean) =>
            new Promise<void>((resolve, reject) => {
                let settled = false;
                const onSuccess = () => {
                    if (settled) return;
                    settled = true;
                    resolve();
                };
                const onFailure = () => {
                    if (!settled) {
                        settled = true;
                        reject(new PrinterError('not-found'));
                    } else {
                        // Koneksi yang tadinya hidup kini terputus.
                        this.setStatus('disconnected');
                    }
                };
                if (insecure) plugin.connectInsecure(address, onSuccess, onFailure);
                else plugin.connect(address, onSuccess, onFailure);
            });

        return tryConnect(false).catch(() => tryConnect(true));
    }

    disconnect(): void {
        const plugin = this.plugin;
        if (plugin) {
            plugin.disconnect(
                () => undefined,
                () => undefined,
            );
        }
        this.setStatus('disconnected');
    }

    /** Kirim byte ESC/POS ke printer, dipotong per chunk. */
    async print(data: Uint8Array): Promise<void> {
        const plugin = this.plugin;
        if (!this.isConnected() || !plugin) {
            throw new PrinterError('disconnected');
        }
        try {
            for (
                let offset = 0;
                offset < data.length;
                offset += WRITE_CHUNK_SIZE
            ) {
                const chunk = data.slice(offset, offset + WRITE_CHUNK_SIZE);
                await new Promise<void>((resolve, reject) => {
                    plugin.write(
                        toArrayBuffer(chunk),
                        () => resolve(),
                        () => reject(new PrinterError('write-failed')),
                    );
                });
                if (offset + WRITE_CHUNK_SIZE < data.length) {
                    await delay(CHUNK_DELAY_MS);
                }
            }
        } catch (error) {
            if (error instanceof PrinterError) throw error;
            throw new PrinterError('write-failed');
        }
    }
}

/** Salin ke ArrayBuffer baru agar plugin menerima byte utuh. */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(view.length);
    copy.set(view);
    return copy.buffer;
}

/** Instance tunggal — status bertahan antar halaman Inertia. */
export const nativePrinterService = new NativeBluetoothPrinterService();
