import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { MotionConfig } from 'framer-motion';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { registerServiceWorker } from './lib/registerSw';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// PWA (Fase 15) — service worker hanya di build produksi; gagal
// registrasi tidak mengganggu aplikasi
registerServiceWorker();

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        // reducedMotion="user" — seluruh animasi Framer Motion
        // menghormati prefers-reduced-motion (PRD Bab 14, Fase 13)
        root.render(
            <MotionConfig reducedMotion="user">
                <App {...props} />
            </MotionConfig>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});
