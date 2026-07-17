import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

/**
 * True selama ada kunjungan Inertia berjalan (filter/search/pagination)
 * — dipakai untuk menampilkan skeleton loading (PRD Bab 10, Fase 12).
 */
export default function useNavigating(): boolean {
    const [navigating, setNavigating] = useState(false);

    useEffect(() => {
        const offStart = router.on('start', () => setNavigating(true));
        const offFinish = router.on('finish', () => setNavigating(false));

        return () => {
            offStart();
            offFinish();
        };
    }, []);

    return navigating;
}
