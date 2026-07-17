/*
 * Service Worker — Pitou Cafe POS (Fase 15, PRD 5.14).
 *
 * Strategi per jenis request (menjaga konsistensi data — PRD Bab 9):
 * - /build/*            → cache-first   (asset Vite ber-hash, immutable)
 * - ikon/gambar/font    → stale-while-revalidate
 * - navigasi halaman    → network-first (selalu segar saat online);
 *                         offline → salinan terakhir dari cache,
 *                         fallback halaman /kasir, lalu halaman offline
 * - request Inertia XHR (header X-Inertia), non-GET, dan endpoint data
 *   (/kasir/offline-data, /kasir/bayar, dsb) → TIDAK PERNAH di-cache;
 *   data dinamis dilayani IndexedDB oleh aplikasi, bukan SW.
 */

const VERSION = 'pitou-pos-v1';
const ASSET_CACHE = VERSION + '-assets';
const PAGE_CACHE = VERSION + '-pages';

/* Di-precache saat install — shell PWA minimal */
const PRECACHE_URLS = [
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/favicon.ico',
];

/* Halaman yang boleh disimpan salinannya untuk mode offline */
const PAGE_PREFIXES = [
    '/kasir',
    '/login',
    '/produk',
    '/kategori',
    '/riwayat',
    '/pengeluaran',
    '/laporan',
    '/pengaturan',
];

/* Endpoint data — jangan pernah dilayani dari cache */
const NEVER_CACHE_PATHS = ['/kasir/offline-data', '/kasir/bayar', '/kasir/hitung'];

const swPolicy = {
    /** Asset Vite ber-hash → aman di-cache selamanya (cache-first). */
    isImmutableAsset(url) {
        return url.pathname.startsWith('/build/');
    },

    /** Asset statis lain → stale-while-revalidate. */
    isStaticAsset(url) {
        return (
            url.hostname === 'fonts.bunny.net' ||
            url.pathname.startsWith('/icons/') ||
            url.pathname.startsWith('/images/') ||
            url.pathname.startsWith('/storage/') ||
            url.pathname === '/favicon.ico' ||
            url.pathname === '/manifest.webmanifest'
        );
    },

    /** Halaman navigasi yang salinannya boleh dipakai saat offline. */
    isCacheablePage(url) {
        if (url.pathname === '/') return true;
        return PAGE_PREFIXES.some(
            (prefix) =>
                url.pathname === prefix ||
                url.pathname.startsWith(prefix + '/'),
        );
    },

    /**
     * Request yang tidak boleh disentuh cache sama sekali: non-GET,
     * Inertia XHR (JSON per-halaman — bisa membuat data tidak
     * konsisten), dan endpoint data kasir.
     */
    shouldBypassCache(request) {
        if (request.method !== 'GET') return true;
        if (request.headers.get('X-Inertia') === 'true') return true;

        const url = new URL(request.url);
        return NEVER_CACHE_PATHS.some((path) => url.pathname === path);
    },

    /** Response yang layak disimpan (sukses penuh, bukan partial/error). */
    isCacheableResponse(response) {
        return Boolean(response && response.ok && response.status === 200);
    },
};

/* Halaman darurat bila offline & belum ada salinan halaman di cache */
const OFFLINE_HTML =
    '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Offline - Pitou Cafe POS</title>' +
    '<style>body{font-family:system-ui,sans-serif;background:#f5f6fa;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}' +
    '.card{background:#fff;border-radius:16px;padding:32px;max-width:360px;text-align:center;box-shadow:0 1px 3px rgba(15,23,42,.1)}' +
    'h1{font-size:18px;color:#0f172a;margin:0 0 8px}p{color:#64748b;font-size:14px;margin:0 0 20px}' +
    'a{display:inline-block;background:#0A45FE;color:#fff;text-decoration:none;font-weight:600;border-radius:12px;padding:10px 24px}</style></head>' +
    '<body><div class="card"><h1>🔴 Anda sedang offline</h1>' +
    '<p>Halaman ini belum tersimpan untuk mode offline. Buka halaman Kasir, atau periksa koneksi internet lalu coba lagi.</p>' +
    '<a href="/kasir">Buka Kasir</a></div></body></html>';

async function precache() {
    const cache = await caches.open(ASSET_CACHE);
    // Gagal precache satu file tidak boleh menggagalkan install
    await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
}

async function cleanOldCaches() {
    const keys = await caches.keys();
    await Promise.all(
        keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
    );
}

/** Cache-first — asset immutable ber-hash. */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (swPolicy.isCacheableResponse(response)) {
        const cache = await caches.open(ASSET_CACHE);
        cache.put(request, response.clone());
    }
    return response;
}

/** Stale-while-revalidate — sajikan cache, segarkan di belakang. */
async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);

    const refresh = fetch(request)
        .then(async (response) => {
            if (swPolicy.isCacheableResponse(response)) {
                const cache = await caches.open(ASSET_CACHE);
                await cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => undefined);

    return cached || refresh.then((r) => r || Response.error());
}

/** Network-first untuk navigasi — offline → cache → /kasir → darurat. */
async function pageNetworkFirst(request) {
    try {
        const response = await fetch(request);

        if (swPolicy.isCacheableResponse(response)) {
            const url = new URL(request.url);
            if (swPolicy.isCacheablePage(url)) {
                const cache = await caches.open(PAGE_CACHE);
                await cache.put(request, response.clone());
            }
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;

        const kasir = await caches.match('/kasir');
        if (kasir) return kasir;

        return new Response(OFFLINE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(cleanOldCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Non-GET / Inertia XHR / endpoint data → langsung jaringan
    if (swPolicy.shouldBypassCache(request)) return;

    const url = new URL(request.url);

    if (swPolicy.isImmutableAsset(url)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    if (swPolicy.isStaticAsset(url)) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    if (request.mode === 'navigate' && url.origin === self.location.origin) {
        event.respondWith(pageNetworkFirst(request));
        return;
    }

    // Lainnya (XHR data, cross-origin tak dikenal) → jaringan murni
});

/* Diekspos untuk unit test (vitest) — bukan bagian API runtime */
self.swPolicy = swPolicy;
