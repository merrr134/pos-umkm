import { readFileSync } from 'fs';
import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Uji kebijakan cache Service Worker (Fase 15). sw.js adalah skrip
 * standalone (bukan modul ESM) yang disajikan di /sw.js, jadi isinya
 * dieksekusi dalam konteks `self` tiruan lalu `self.swPolicy` diambil.
 * Handler fetch tidak dipanggil — hanya logika keputusan yang diuji.
 */

interface RequestLike {
    method: string;
    url: string;
    headers: { get(name: string): string | null };
    mode?: string;
}

function request(
    url: string,
    init: {
        method?: string;
        mode?: string;
        headers?: Record<string, string>;
    } = {},
): RequestLike {
    const headers: Record<string, string> = init.headers ?? {};
    return {
        method: init.method ?? 'GET',
        url,
        mode: init.mode,
        headers: { get: (name) => headers[name] ?? null },
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let swPolicy: any;

beforeAll(() => {
    const code = readFileSync(
        path.resolve(__dirname, '../../../../public/sw.js'),
        'utf-8',
    );

    const self = {
        addEventListener: () => undefined,
        location: { origin: 'https://pos.pitou.test' },
        skipWaiting: () => undefined,
        clients: { claim: () => undefined },
    } as Record<string, unknown>;

    const factory = new Function(
        'self',
        'URL',
        code + '\nreturn self.swPolicy;',
    );
    swPolicy = factory(self, URL);
});

const origin = 'https://pos.pitou.test';

describe('swPolicy.isImmutableAsset', () => {
    it('asset build Vite ber-hash → true', () => {
        expect(swPolicy.isImmutableAsset(new URL(origin + '/build/app.js'))).toBe(
            true,
        );
    });
    it('bukan /build → false', () => {
        expect(swPolicy.isImmutableAsset(new URL(origin + '/kasir'))).toBe(
            false,
        );
    });
});

describe('swPolicy.isStaticAsset', () => {
    it('ikon, gambar, storage, favicon, manifest → true', () => {
        for (const p of [
            '/icons/icon-192.png',
            '/images/logo.png',
            '/storage/products/a.jpg',
            '/favicon.ico',
            '/manifest.webmanifest',
        ]) {
            expect(swPolicy.isStaticAsset(new URL(origin + p))).toBe(true);
        }
    });

    it('halaman biasa → false', () => {
        expect(swPolicy.isStaticAsset(new URL(origin + '/kasir'))).toBe(false);
    });
});

describe('swPolicy.isCacheablePage', () => {
    it('halaman inti aplikasi → true', () => {
        for (const p of [
            '/',
            '/kasir',
            '/login',
            '/produk',
            '/pengaturan',
            '/riwayat/5',
        ]) {
            expect(swPolicy.isCacheablePage(new URL(origin + p))).toBe(true);
        }
    });

    it('endpoint yang tak boleh di-cache sebagai halaman → false', () => {
        expect(
            swPolicy.isCacheablePage(new URL(origin + '/tidak-dikenal')),
        ).toBe(false);
    });
});

describe('swPolicy.shouldBypassCache (jaga konsistensi data)', () => {
    it('non-GET → bypass', () => {
        expect(
            swPolicy.shouldBypassCache(
                request(origin + '/kasir/bayar', { method: 'POST' }),
            ),
        ).toBe(true);
    });

    it('request Inertia XHR (X-Inertia) → bypass', () => {
        expect(
            swPolicy.shouldBypassCache(
                request(origin + '/kasir', {
                    headers: { 'X-Inertia': 'true' },
                }),
            ),
        ).toBe(true);
    });

    it('endpoint data kasir → bypass', () => {
        for (const p of [
            '/kasir/offline-data',
            '/kasir/bayar',
            '/kasir/hitung',
        ]) {
            expect(
                swPolicy.shouldBypassCache(request(origin + p)),
            ).toBe(true);
        }
    });

    it('navigasi GET biasa → tidak bypass', () => {
        expect(swPolicy.shouldBypassCache(request(origin + '/kasir'))).toBe(
            false,
        );
    });
});

describe('swPolicy.isCacheableResponse', () => {
    it('200 ok → true', () => {
        expect(swPolicy.isCacheableResponse({ ok: true, status: 200 })).toBe(
            true,
        );
    });
    it('opaque/partial/error → false', () => {
        expect(swPolicy.isCacheableResponse({ ok: false, status: 0 })).toBe(
            false,
        );
        expect(swPolicy.isCacheableResponse({ ok: true, status: 206 })).toBe(
            false,
        );
        expect(swPolicy.isCacheableResponse(undefined)).toBe(false);
    });
});
