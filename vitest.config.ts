import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Konfigurasi Vitest — test unit frontend.
 * Fase 14: service printer Bluetooth, encoder ESC/POS, fallback print.
 * Fase 15: IndexedDB (fake-indexeddb), antrean & sinkronisasi offline,
 *          indikator sync, service worker policy.
 * Environment node; Web API yang dibutuhkan di-mock/di-inject per file.
 */
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
        },
    },
    test: {
        include: ['resources/js/**/*.test.ts'],
        environment: 'node',
        setupFiles: ['resources/js/test/setup.ts'],
    },
});
