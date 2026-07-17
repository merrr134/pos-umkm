import { StockStatus } from './stok';

const badgeStyles: Record<StockStatus, { label: string; className: string }> = {
    normal: { label: 'Normal', className: 'bg-green-50 text-green-700' },
    menipis: { label: 'Stok Menipis', className: 'bg-amber-50 text-amber-600' },
    habis: { label: 'Habis', className: 'bg-red-50 text-red-600' },
    untracked: {
        label: 'Tidak dilacak',
        className: 'bg-slate-100 text-slate-500',
    },
};

/**
 * Badge level stok (Fase 7): hijau normal, kuning menipis,
 * merah habis, abu-abu untuk produk tanpa kelola stok.
 */
export default function StockBadge({ status }: { status: StockStatus }) {
    const badge = badgeStyles[status];

    return (
        <span
            className={
                'inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ' +
                badge.className
            }
        >
            {badge.label}
        </span>
    );
}
