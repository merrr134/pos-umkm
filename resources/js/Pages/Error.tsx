import { AlertTriangleIcon, SearchIcon } from '@/Components/Icons';
import PitouLogo from '@/Components/PitouLogo';
import { Head, Link } from '@inertiajs/react';

/**
 * Halaman error ramah (PRD Bab 9, Fase 12) — 404/403/500/503.
 * Tidak menampilkan stack trace; selalu ada jalan kembali.
 */
const CONTENT: Record<
    number,
    { title: string; description: string }
> = {
    403: {
        title: 'Akses Ditolak',
        description:
            'Anda tidak memiliki izin untuk membuka halaman ini. Hubungi Owner jika Anda merasa seharusnya punya akses.',
    },
    404: {
        title: 'Halaman Tidak Ditemukan',
        description:
            'Data atau halaman yang Anda cari tidak ada, sudah dipindahkan, atau sudah dihapus.',
    },
    500: {
        title: 'Terjadi Kesalahan Server',
        description:
            'Ada masalah di sisi kami. Silakan coba lagi beberapa saat lagi — data Anda tetap aman.',
    },
    503: {
        title: 'Sedang Dalam Perawatan',
        description:
            'Aplikasi sedang dalam perawatan sebentar. Silakan coba lagi beberapa menit lagi.',
    },
};

export default function Error({ status }: { status: number }) {
    const content = CONTENT[status] ?? CONTENT[500];

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f6fa] px-4">
            <Head title={content.title} />

            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="flex justify-center">
                    <PitouLogo className="h-12 w-12" />
                </div>

                <span className="mt-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    {status === 404 ? (
                        <SearchIcon className="h-7 w-7" />
                    ) : (
                        <AlertTriangleIcon className="h-7 w-7" />
                    )}
                </span>

                <p className="mt-4 text-sm font-bold uppercase tracking-widest text-slate-400">
                    Error {status}
                </p>
                <h1 className="mt-1 text-xl font-bold text-slate-900">
                    {content.title}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                    {content.description}
                </p>

                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        Kembali
                    </button>
                    <Link
                        href="/kasir"
                        className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                    >
                        Ke Halaman Kasir
                    </Link>
                </div>
            </div>
        </div>
    );
}
