/**
 * Tipe minimal Web Bluetooth API (Fase 14 — Printer Bluetooth).
 * Lib DOM TypeScript belum menyertakan Web Bluetooth, jadi bagian
 * yang dipakai printerService dideklarasikan sendiri di sini.
 */

interface BluetoothRequestDeviceOptions {
    acceptAllDevices?: boolean;
    filters?: { services?: string[]; namePrefix?: string }[];
    optionalServices?: string[];
}

interface Bluetooth {
    requestDevice(
        options?: BluetoothRequestDeviceOptions,
    ): Promise<BluetoothDevice>;
}

interface BluetoothDevice {
    readonly id: string;
    readonly name?: string;
    readonly gatt?: BluetoothRemoteGATTServer;
    addEventListener(
        type: 'gattserverdisconnected',
        listener: () => void,
    ): void;
    removeEventListener(
        type: 'gattserverdisconnected',
        listener: () => void,
    ): void;
}

interface BluetoothRemoteGATTServer {
    readonly connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTService {
    readonly uuid: string;
    getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothCharacteristicProperties {
    readonly write: boolean;
    readonly writeWithoutResponse: boolean;
}

interface BluetoothRemoteGATTCharacteristic {
    readonly uuid: string;
    readonly properties: BluetoothCharacteristicProperties;
    writeValue(value: BufferSource): Promise<void>;
    writeValueWithoutResponse(value: BufferSource): Promise<void>;
}

interface Navigator {
    readonly bluetooth?: Bluetooth;
}
