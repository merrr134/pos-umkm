import { TransactionStatus } from './riwayat';

/**
 * Badge status transaksi (PRD 5.4) — paid hijau, cancelled merah
 * sebagai penanda visual untuk jejak audit.
 */
export default function StatusBadge({
    status,
}: {
    status: TransactionStatus;
}) {
    return (
        <span
            className={
                'inline-flex rounded-full px-3 py-1 text-xs font-semibold ' +
                (status === 'paid'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-600')
            }
        >
            {status === 'paid' ? 'Berhasil' : 'Dibatalkan'}
        </span>
    );
}
