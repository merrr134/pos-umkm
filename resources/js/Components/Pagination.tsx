import { ChevronLeftIcon, ChevronRightIcon } from '@/Components/Icons';
import { Paginated } from '@/types';
import { Link } from '@inertiajs/react';

/**
 * Pagination gaya desain (docs/design/product.png):
 * "Menampilkan X - Y dari Z data" + tombol halaman bernomor.
 */
export default function Pagination({
    paginator,
}: {
    paginator: Paginated<unknown>;
}) {
    if (paginator.total === 0) {
        return null;
    }

    const pageLinks = paginator.links.slice(1, -1);
    const prev = paginator.links[0];
    const next = paginator.links[paginator.links.length - 1];

    const buttonBase =
        'flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors duration-150';

    return (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-slate-500">
                Menampilkan {paginator.from ?? 0} - {paginator.to ?? 0} dari{' '}
                {paginator.total} data
            </p>

            <nav className="flex items-center gap-1.5" aria-label="Pagination">
                {prev.url ? (
                    <Link
                        href={prev.url}
                        preserveState
                        preserveScroll
                        aria-label="Halaman sebelumnya"
                        className={`${buttonBase} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                    </Link>
                ) : (
                    <span
                        className={`${buttonBase} cursor-default border-slate-100 bg-white text-slate-300`}
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                    </span>
                )}

                {pageLinks.map((link, index) =>
                    link.url ? (
                        <Link
                            key={index}
                            href={link.url}
                            preserveState
                            preserveScroll
                            className={
                                buttonBase +
                                ' ' +
                                (link.active
                                    ? 'border-[#0A45FE] bg-[#0A45FE] text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                            }
                        >
                            {link.label}
                        </Link>
                    ) : (
                        <span
                            key={index}
                            className={`${buttonBase} cursor-default border-transparent bg-transparent text-slate-400`}
                        >
                            {link.label}
                        </span>
                    ),
                )}

                {next.url ? (
                    <Link
                        href={next.url}
                        preserveState
                        preserveScroll
                        aria-label="Halaman berikutnya"
                        className={`${buttonBase} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                    </Link>
                ) : (
                    <span
                        className={`${buttonBase} cursor-default border-slate-100 bg-white text-slate-300`}
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                    </span>
                )}
            </nav>
        </div>
    );
}
