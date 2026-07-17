import { useEffect, useState } from 'react';

/** Status koneksi browser — reaktif terhadap event online/offline. */
export default function useOnline(): boolean {
    const [online, setOnline] = useState(true);

    useEffect(() => {
        setOnline(navigator.onLine);

        const goOnline = () => setOnline(true);
        const goOffline = () => setOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    return online;
}
