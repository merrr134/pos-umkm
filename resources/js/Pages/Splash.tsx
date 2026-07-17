import ApplicationLogo from '@/Components/ApplicationLogo';
import { PageProps } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { useEffect } from 'react';

/**
 * Splash screen — landing awal aplikasi.
 * Setelah jeda singkat, user diarahkan ke Kasir; jika belum login,
 * middleware auth akan mengarahkan ke halaman Login.
 */
export default function Splash() {
    const { store } = usePage<PageProps>().props;

    useEffect(() => {
        const timer = window.setTimeout(() => {
            router.visit(route('kasir'));
        }, 1200);

        return () => window.clearTimeout(timer);
    }, []);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
            <Head title="Selamat Datang" />

            {/* Logo fade + scale, smooth easing (PRD Bab 14, Fase 13) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
                {store.logo ? (
                    <img
                        src={store.logo}
                        alt={store.name}
                        className="h-24 w-24 object-contain"
                    />
                ) : (
                    <ApplicationLogo className="h-24 w-24 fill-current text-gray-700" />
                )}
            </motion.div>

            <motion.div
                className="flex flex-col items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.15 }}
            >
                <h1 className="mt-4 text-2xl font-semibold text-gray-800">
                    {store.name}
                </h1>
                <p className="mt-1 text-sm text-gray-500">Memuat aplikasi…</p>
            </motion.div>
        </div>
    );
}
