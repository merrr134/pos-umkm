/**
 * Tipe minimal untuk plugin Cordova yang dipakai printer Bluetooth
 * Classic (SPP) di Android — Fase 14 lanjutan.
 *
 * - cordova-plugin-bluetooth-serial  → window.bluetoothSerial
 * - cordova-plugin-android-permissions → window.cordova.plugins.permissions
 *
 * WebView Android tidak punya Web Bluetooth, dan printer thermal 58mm
 * (mis. Ainuo 58D) memakai Bluetooth Classic, bukan BLE — sehingga
 * jalur native ini yang dipakai di dalam APK.
 */

/** Perangkat Bluetooth yang sudah ter-pair (bonded) di sistem. */
export interface BluetoothSerialDevice {
    /** MAC address (dipakai untuk connect). */
    address: string;
    /** Nama tampilan perangkat. */
    name?: string;
    id?: string;
    class?: number;
}

export interface BluetoothSerialPlugin {
    list(
        success: (devices: BluetoothSerialDevice[]) => void,
        failure: (error: string) => void,
    ): void;
    isEnabled(success: () => void, failure: () => void): void;
    enable(success: () => void, failure: (error: string) => void): void;
    /** Sambung SPP aman (UUID 1101). success dipanggil saat konek. */
    connect(
        address: string,
        success: () => void,
        failure: (error: string) => void,
    ): void;
    /** Sambung SPP insecure — sebagian printer murah butuh ini. */
    connectInsecure(
        address: string,
        success: () => void,
        failure: (error: string) => void,
    ): void;
    disconnect(success: () => void, failure: (error: string) => void): void;
    isConnected(success: () => void, failure: () => void): void;
    /** Kirim data mentah (ArrayBuffer untuk byte ESC/POS). */
    write(
        data: ArrayBuffer | Uint8Array | string,
        success: () => void,
        failure: (error: string) => void,
    ): void;
}

export interface AndroidPermissionsPlugin {
    PERMISSION: Record<string, string>;
    checkPermission(
        permission: string,
        success: (status: { hasPermission: boolean }) => void,
        error: () => void,
    ): void;
    requestPermissions(
        permissions: string[],
        success: (status: { hasPermission: boolean }) => void,
        error: () => void,
    ): void;
}

declare global {
    interface Window {
        bluetoothSerial?: BluetoothSerialPlugin;
        cordova?: {
            plugins?: {
                permissions?: AndroidPermissionsPlugin;
            };
        };
    }
}
