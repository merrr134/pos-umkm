import { PageProps } from '@/types';
import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';

/**
 * Auto logout saat idle melewati batas session timeout (PRD Bab 13 — Security).
 *
 * Setelah tidak ada aktivitas selama `session.lifetime` menit, user diarahkan
 * ke halaman login dengan pesan "Sesi berakhir". Jika sesi ternyata masih
 * berlaku (misalnya Remember Me aktif), server akan mengarahkan kembali ke
 * Kasir secara otomatis.
 */
export default function useAutoLogout(): void {
    const { session } = usePage<PageProps>().props;
    const lifetimeMinutes = session?.lifetime ?? 30;

    useEffect(() => {
        let timer: number;

        const resetTimer = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(
                () => {
                    window.location.href = '/login?expired=1';
                },
                lifetimeMinutes * 60 * 1000,
            );
        };

        const events = [
            'mousemove',
            'mousedown',
            'keydown',
            'scroll',
            'touchstart',
        ] as const;

        events.forEach((event) =>
            window.addEventListener(event, resetTimer, { passive: true }),
        );
        resetTimer();

        return () => {
            window.clearTimeout(timer);
            events.forEach((event) =>
                window.removeEventListener(event, resetTimer),
            );
        };
    }, [lifetimeMinutes]);
}
