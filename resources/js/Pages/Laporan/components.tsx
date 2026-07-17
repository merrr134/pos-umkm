import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { ComponentType, ReactNode, SVGAttributes } from 'react';

/* Komponen bersama halaman Laporan (Fase 10) */

export const filterInputClass =
    'h-12 rounded-xl border-slate-200 bg-white px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

export const filterSelectClass =
    'h-12 rounded-xl border-slate-200 bg-white pl-4 pr-10 text-slate-900 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

export const cellClass =
    'border-y border-slate-200 bg-white px-4 py-4 align-middle transition-colors duration-150 group-hover:bg-slate-50';

const tabs = [
    { label: 'Dashboard', route: 'laporan' },
    { label: 'Penjualan', route: 'laporan.penjualan' },
    { label: 'Pembelian', route: 'laporan.pembelian' },
    { label: 'Pengeluaran', route: 'laporan.pengeluaran' },
    { label: 'Stok', route: 'laporan.stok' },
];

/** Tab navigasi antar laporan — kasir hanya melihat Penjualan. */
export function ReportTabs() {
    const { auth } = usePage<PageProps>().props;

    if (auth.user.role === 'kasir') {
        return null;
    }

    return (
        <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {tabs.map((tab) =>
                route().current(tab.route) ? (
                    <span
                        key={tab.route}
                        className="rounded-lg bg-[#0A45FE] px-4 py-2 text-sm font-semibold text-white"
                    >
                        {tab.label}
                    </span>
                ) : (
                    <Link
                        key={tab.route}
                        href={route(tab.route)}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                    >
                        {tab.label}
                    </Link>
                ),
            )}
        </div>
    );
}

/**
 * Tombol Export PDF & Excel — href membawa filter aktif sehingga
 * hasil export selalu mengikuti tampilan (Fase 10).
 */
export function ExportButtons({
    routeName,
    params,
}: {
    routeName: string;
    params: Record<string, string>;
}) {
    const buttonClass =
        'inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50';

    return (
        <div className="flex gap-2">
            <a
                href={route(routeName, { format: 'pdf', ...params })}
                className={buttonClass}
            >
                Export PDF
            </a>
            <a
                href={route(routeName, { format: 'excel', ...params })}
                className={buttonClass}
            >
                Export Excel
            </a>
        </div>
    );
}

export function StatCard({
    icon: IconComponent,
    chipClass,
    label,
    value,
    hint,
    delay = 0,
}: {
    icon: ComponentType<SVGAttributes<SVGElement>>;
    chipClass: string;
    label: string;
    value: string;
    hint?: string;
    delay?: number;
}) {
    return (
        <motion.div
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay, ease: 'easeOut' }}
        >
            <span
                className={
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ' +
                    chipClass
                }
            >
                <IconComponent className="h-6 w-6" />
            </span>
            <div className="min-w-0">
                <p className="truncate text-sm text-slate-500">{label}</p>
                <p className="truncate text-xl font-bold text-slate-900">
                    {value}
                </p>
                {hint && (
                    <p className="truncate text-xs text-slate-400">{hint}</p>
                )}
            </div>
        </motion.div>
    );
}

/**
 * Kartu pembungkus grafik dengan judul + empty state seragam.
 * Fade-up ber-delay → grafik dashboard muncul bertahap (Fase 13).
 */
export function ChartCard({
    title,
    subtitle,
    empty,
    delay = 0,
    children,
}: {
    title: string;
    subtitle?: string;
    empty: boolean;
    delay?: number;
    children: ReactNode;
}) {
    return (
        <motion.div
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay, ease: 'easeOut' }}
        >
            <h2 className="font-bold text-slate-900">{title}</h2>
            {subtitle && (
                <p className="text-xs text-slate-400">{subtitle}</p>
            )}
            <div className="mt-4 h-72">
                {empty ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                        Belum ada data untuk periode ini.
                    </div>
                ) : (
                    children
                )}
            </div>
        </motion.div>
    );
}
