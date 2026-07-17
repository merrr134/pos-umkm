import { SupplierStatus } from './supplier';

/** Badge status supplier (Fase 8) — aktif hijau, nonaktif abu-abu. */
export default function StatusBadge({ status }: { status: SupplierStatus }) {
    return (
        <span
            className={
                'inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ' +
                (status === 'aktif'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-slate-100 text-slate-500')
            }
        >
            {status === 'aktif' ? 'Aktif' : 'Nonaktif'}
        </span>
    );
}
