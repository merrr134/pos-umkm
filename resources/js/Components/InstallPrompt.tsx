import { XIcon } from '@/Components/Icons';
import { useEffect, useState } from 'react';

/**
 * Install Prompt PWA (Fase 15) — menangkap beforeinstallprompt
 * (Android / Desktop Chromium) dan menampilkan ajakan install kecil.
 * Penolakan diingat di localStorage agar tidak mengganggu kasir.
 */

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pitou-install-dismissed';

export default function InstallPrompt() {
    const [installEvent, setInstallEvent] =
        useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        const onPrompt = (event: Event) => {
            event.preventDefault();
            try {
                if (localStorage.getItem(DISMISS_KEY) === '1') return;
            } catch {
                // localStorage tidak tersedia → tetap tawarkan install
            }
            setInstallEvent(event as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', onPrompt);
        return () =>
            window.removeEventListener('beforeinstallprompt', onPrompt);
    }, []);

    if (installEvent === null) return null;

    const install = async () => {
        const event = installEvent;
        setInstallEvent(null);
        await event.prompt();
    };

    const dismiss = () => {
        setInstallEvent(null);
        try {
            localStorage.setItem(DISMISS_KEY, '1');
        } catch {
            // abaikan — hanya kehilangan preferensi "jangan tampilkan lagi"
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg print:hidden">
            <img
                src="/icons/icon-192.png"
                alt="Pitou Cafe POS"
                className="h-9 w-9 rounded-xl"
            />
            <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                    Install Pitou Cafe POS
                </p>
                <p className="text-xs text-slate-500">
                    Akses lebih cepat, bisa dipakai offline.
                </p>
            </div>
            <button
                type="button"
                onClick={() => void install()}
                className="rounded-xl bg-[#0A45FE] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
            >
                Install
            </button>
            <button
                type="button"
                aria-label="Tutup ajakan install"
                onClick={dismiss}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
                <XIcon className="h-4 w-4" />
            </button>
        </div>
    );
}
