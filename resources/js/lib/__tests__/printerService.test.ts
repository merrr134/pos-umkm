import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BluetoothPrinterService,
    PrinterError,
    PRINTER_ERROR_MESSAGES,
    PrinterStatus,
} from '../printerService';

/* ------------------------- Mock Web Bluetooth ------------------------- */

interface MockSetup {
    bluetooth: Bluetooth;
    device: BluetoothDevice & {
        listeners: Map<string, () => void>;
    };
    characteristic: BluetoothRemoteGATTCharacteristic & {
        writes: Uint8Array[];
    };
    gatt: {
        connected: boolean;
        connect: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
        getPrimaryServices: ReturnType<typeof vi.fn>;
    };
    requestDevice: ReturnType<typeof vi.fn>;
}

function makeBluetoothMock(): MockSetup {
    const writes: Uint8Array[] = [];

    const characteristic = {
        uuid: '00002af1-0000-1000-8000-00805f9b34fb',
        properties: { write: true, writeWithoutResponse: true },
        writeValue: vi.fn(async (value: BufferSource) => {
            writes.push(new Uint8Array(value as ArrayBufferView as Uint8Array));
        }),
        writeValueWithoutResponse: vi.fn(async (value: BufferSource) => {
            writes.push(new Uint8Array(value as ArrayBufferView as Uint8Array));
        }),
        writes,
    } as unknown as MockSetup['characteristic'];

    const service = {
        uuid: '000018f0-0000-1000-8000-00805f9b34fb',
        getCharacteristics: vi.fn(async () => [characteristic]),
    };

    const gatt = {
        connected: false,
        connect: vi.fn(),
        disconnect: vi.fn(() => {
            gatt.connected = false;
        }),
        getPrimaryServices: vi.fn(async () => [service]),
    };
    gatt.connect.mockImplementation(async () => {
        gatt.connected = true;
        return gatt;
    });

    const listeners = new Map<string, () => void>();
    const device = {
        id: 'printer-1',
        name: 'Thermal 58mm',
        gatt,
        listeners,
        addEventListener: vi.fn((type: string, listener: () => void) => {
            listeners.set(type, listener);
        }),
        removeEventListener: vi.fn((type: string) => {
            listeners.delete(type);
        }),
    } as unknown as MockSetup['device'];

    const requestDevice = vi.fn(async () => device);
    const bluetooth = { requestDevice } as unknown as Bluetooth;

    return { bluetooth, device, characteristic, gatt, requestDevice };
}

function makeService(
    bluetooth: Bluetooth | undefined,
    options: { connectTimeoutMs?: number; writeTimeoutMs?: number } = {},
): BluetoothPrinterService {
    return new BluetoothPrinterService({
        getBluetooth: () => bluetooth,
        ...options,
    });
}

function domException(name: string): Error {
    const error = new Error(name);
    error.name = name;
    return error;
}

/* ------------------------------- Tests -------------------------------- */

describe('BluetoothPrinterService — dukungan browser', () => {
    it('isSupported false bila Web Bluetooth tidak tersedia', () => {
        expect(makeService(undefined).isSupported()).toBe(false);
    });

    it('connect di browser tanpa Web Bluetooth → error unsupported', async () => {
        const service = makeService(undefined);
        await expect(service.connect()).rejects.toMatchObject({
            code: 'unsupported',
            message: PRINTER_ERROR_MESSAGES.unsupported,
        });
        expect(service.getStatus()).toBe('disconnected');
    });
});

describe('BluetoothPrinterService — koneksi', () => {
    let mock: MockSetup;

    beforeEach(() => {
        mock = makeBluetoothMock();
    });

    it('connect sukses → status connecting lalu connected', async () => {
        const service = makeService(mock.bluetooth);
        const statuses: PrinterStatus[] = [];
        service.subscribe((status) => statuses.push(status));

        await service.connect();

        expect(statuses).toEqual(['connecting', 'connected']);
        expect(service.isConnected()).toBe(true);
        expect(service.getDeviceName()).toBe('Thermal 58mm');
    });

    it('user membatalkan pemilih perangkat → error not-found', async () => {
        mock.requestDevice.mockRejectedValue(domException('NotFoundError'));
        const service = makeService(mock.bluetooth);

        await expect(service.connect()).rejects.toMatchObject({
            code: 'not-found',
        });
        expect(service.getStatus()).toBe('disconnected');
    });

    it('izin Bluetooth ditolak → error permission-denied', async () => {
        mock.requestDevice.mockRejectedValue(domException('NotAllowedError'));
        const service = makeService(mock.bluetooth);

        await expect(service.connect()).rejects.toMatchObject({
            code: 'permission-denied',
            message: PRINTER_ERROR_MESSAGES['permission-denied'],
        });
    });

    it('koneksi GATT menggantung → error timeout', async () => {
        mock.gatt.connect.mockImplementation(
            () => new Promise(() => undefined), // tidak pernah selesai
        );
        const service = makeService(mock.bluetooth, { connectTimeoutMs: 20 });

        await expect(service.connect()).rejects.toMatchObject({
            code: 'timeout',
            message: PRINTER_ERROR_MESSAGES.timeout,
        });
        expect(service.getStatus()).toBe('disconnected');
    });

    it('printer tanpa characteristic tulis → error not-found', async () => {
        mock.gatt.getPrimaryServices.mockResolvedValue([
            {
                uuid: 'x',
                getCharacteristics: async () => [
                    {
                        uuid: 'y',
                        properties: {
                            write: false,
                            writeWithoutResponse: false,
                        },
                    },
                ],
            },
        ]);
        const service = makeService(mock.bluetooth);

        await expect(service.connect()).rejects.toMatchObject({
            code: 'not-found',
        });
    });

    it('disconnect memutus GATT dan mengubah status', async () => {
        const service = makeService(mock.bluetooth);
        await service.connect();

        service.disconnect();

        expect(mock.gatt.disconnect).toHaveBeenCalled();
        expect(service.isConnected()).toBe(false);
        expect(service.getStatus()).toBe('disconnected');
    });

    it('reconnect memakai perangkat terakhir tanpa pemilih baru', async () => {
        const service = makeService(mock.bluetooth);
        await service.connect();
        service.disconnect();

        await service.reconnect();

        expect(mock.requestDevice).toHaveBeenCalledTimes(1);
        expect(service.isConnected()).toBe(true);
    });

    it('reconnect tanpa perangkat sebelumnya → membuka pemilih', async () => {
        const service = makeService(mock.bluetooth);

        await service.reconnect();

        expect(mock.requestDevice).toHaveBeenCalledTimes(1);
        expect(service.isConnected()).toBe(true);
    });

    it('printer terputus sendiri (gattserverdisconnected) → status disconnected', async () => {
        const service = makeService(mock.bluetooth);
        const statuses: PrinterStatus[] = [];
        service.subscribe((status) => statuses.push(status));

        await service.connect();
        mock.device.listeners.get('gattserverdisconnected')?.();

        expect(service.getStatus()).toBe('disconnected');
        expect(service.isConnected()).toBe(false);
        expect(statuses).toEqual([
            'connecting',
            'connected',
            'disconnected',
        ]);
    });

    it('unsubscribe menghentikan pemantauan status', async () => {
        const service = makeService(mock.bluetooth);
        const statuses: PrinterStatus[] = [];
        const unsubscribe = service.subscribe((status) =>
            statuses.push(status),
        );

        unsubscribe();
        await service.connect();

        expect(statuses).toEqual([]);
    });
});

describe('BluetoothPrinterService — print', () => {
    let mock: MockSetup;

    beforeEach(() => {
        mock = makeBluetoothMock();
    });

    it('print saat belum terhubung → error disconnected', async () => {
        const service = makeService(mock.bluetooth);

        await expect(
            service.print(Uint8Array.from([1, 2, 3])),
        ).rejects.toMatchObject({
            code: 'disconnected',
            message: PRINTER_ERROR_MESSAGES.disconnected,
        });
    });

    it('print mengirim seluruh bytes, dipotong per chunk', async () => {
        const service = makeService(mock.bluetooth);
        await service.connect();

        const data = Uint8Array.from(
            Array.from({ length: 250 }, (_, i) => i % 256),
        );
        await service.print(data);

        // 250 bytes / chunk 100 → 3 tulisan; gabungan = data utuh
        expect(mock.characteristic.writes).toHaveLength(3);
        const sent = Uint8Array.from(
            mock.characteristic.writes.flatMap((chunk) => [...chunk]),
        );
        expect([...sent]).toEqual([...data]);
    });

    it('kegagalan tulis → error write-failed', async () => {
        const service = makeService(mock.bluetooth);
        await service.connect();
        (
            mock.characteristic.writeValueWithoutResponse as ReturnType<
                typeof vi.fn
            >
        ).mockRejectedValue(domException('NetworkError'));

        await expect(
            service.print(Uint8Array.from([1])),
        ).rejects.toMatchObject({
            code: 'write-failed',
            message: PRINTER_ERROR_MESSAGES['write-failed'],
        });
    });

    it('semua PrinterError memakai pesan Bahasa Indonesia', () => {
        for (const message of Object.values(PRINTER_ERROR_MESSAGES)) {
            expect(message.length).toBeGreaterThan(10);
        }
        expect(new PrinterError('timeout').message).toBe(
            PRINTER_ERROR_MESSAGES.timeout,
        );
    });
});
