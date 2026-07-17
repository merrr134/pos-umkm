import { BanIcon, PrinterIcon } from '@/Components/Icons';
import Modal from '@/Components/Modal';
import WhatsappButton from '@/Components/WhatsappButton';
import { normalizePhone } from '@/lib/whatsapp';
import { PageProps } from '@/types';
import { formatRupiah } from '@/Pages/Kasir/kasir';
import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { formatDateTime, TransactionDetail } from './riwayat';
import StatusBadge from './StatusBadge';

/**
 * Modal detail transaksi (PRD 5.11) — seluruh data dari snapshot
 * transaction_items & transactions, bukan tabel products.
 */
export default function DetailModal({
    show,
    detail,
    loading,
    canCancel,
    onClose,
    onReprint,
    onCancel,
}: {
    show: boolean;
    detail: TransactionDetail | null;
    loading: boolean;
    canCancel: boolean;
    onClose: () => void;
    onReprint: () => void;
    onCancel: () => void;
}) {
    // Kirim ulang struk via WhatsApp (Fase 16)
    const { whatsapp } = usePage<PageProps>().props;
    const [waError, setWaError] = useState<string | null>(null);

    useEffect(() => {
        if (show) {
            setWaError(null);
        }
    }, [show]);

    const isCash = detail?.payment_method === 'tunai';

    // Setting ON tapi transaksi ini tanpa nomor → beri tahu (PRD §9)
    const waEnabledNoPhone =
        detail !== null &&
        whatsapp.enabled &&
        normalizePhone(detail.customer_phone) === '';

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <div className="max-h-[90vh] overflow-y-auto p-6">
                {loading || detail === null ? (
                    /* Skeleton loading (PRD Bab 10) */
                    <div className="animate-pulse space-y-4">
                        <div className="h-6 w-48 rounded-lg bg-slate-200" />
                        <div className="h-4 w-64 rounded-lg bg-slate-100" />
                        <div className="h-32 rounded-xl bg-slate-100" />
                        <div className="h-24 rounded-xl bg-slate-100" />
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Detail Transaksi
                                </h2>
                                <p className="text-sm font-semibold text-[#0A45FE]">
                                    {detail.invoice_number}
                                </p>
                            </div>
                            <StatusBadge status={detail.status} />
                        </div>

                        {/* Info transaksi */}
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                            <div>
                                <dt className="text-slate-500">Tanggal</dt>
                                <dd className="font-medium text-slate-900">
                                    {formatDateTime(detail.date)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-500">Kasir</dt>
                                <dd className="font-medium text-slate-900">
                                    {detail.kasir}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-500">
                                    Metode Pembayaran
                                </dt>
                                <dd className="font-medium text-slate-900">
                                    {detail.payment_method_label}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-500">
                                    WhatsApp Pelanggan
                                </dt>
                                <dd className="font-medium text-slate-900">
                                    {detail.customer_phone ?? '—'}
                                </dd>
                            </div>
                        </dl>

                        {/* Info pembatalan */}
                        {detail.status === 'cancelled' && (
                            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
                                <p className="font-semibold text-red-700">
                                    Transaksi dibatalkan
                                </p>
                                <p className="mt-1 text-red-600">
                                    Alasan: {detail.cancel_reason}
                                </p>
                                <p className="mt-1 text-red-600">
                                    Oleh {detail.cancelled_by}
                                    {detail.cancelled_at
                                        ? ` — ${formatDateTime(detail.cancelled_at)}`
                                        : ''}
                                </p>
                            </div>
                        )}

                        {/* Daftar item — harga snapshot */}
                        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                        <th className="px-4 py-2.5 font-medium">
                                            Item
                                        </th>
                                        <th className="px-4 py-2.5 text-center font-medium">
                                            Qty
                                        </th>
                                        <th className="px-4 py-2.5 text-right font-medium">
                                            Harga
                                        </th>
                                        <th className="px-4 py-2.5 text-right font-medium">
                                            Subtotal
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detail.items.map((item, index) => (
                                        <tr
                                            key={index}
                                            className="border-b border-slate-100 last:border-0"
                                        >
                                            <td className="px-4 py-2.5">
                                                <p className="font-medium text-slate-900">
                                                    {item.product_name}
                                                </p>
                                                {item.note && (
                                                    <p className="text-xs text-slate-500">
                                                        Catatan: {item.note}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-slate-700">
                                                {item.quantity}
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-slate-700">
                                                {formatRupiah(item.price)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                                                {formatRupiah(item.subtotal)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Ringkasan pembayaran — dari snapshot transaksi */}
                        <div className="mt-4 space-y-1.5 rounded-xl border border-slate-200 p-4 text-sm">
                            <div className="flex justify-between text-slate-600">
                                <span>Subtotal</span>
                                <span>{formatRupiah(detail.subtotal)}</span>
                            </div>
                            {detail.discount > 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Diskon</span>
                                    <span>
                                        -{formatRupiah(detail.discount)}
                                    </span>
                                </div>
                            )}
                            {detail.tax_name !== null && (
                                <div className="flex justify-between text-slate-600">
                                    <span>
                                        {detail.tax_name} ({detail.tax_percent}
                                        %)
                                    </span>
                                    <span>{formatRupiah(detail.tax_amount)}</span>
                                </div>
                            )}
                            {detail.rounding !== 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Pembulatan</span>
                                    <span>
                                        {detail.rounding > 0 ? '' : '-'}
                                        {formatRupiah(
                                            Math.abs(detail.rounding),
                                        )}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                                <span>Total</span>
                                <span>{formatRupiah(detail.total)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                                <span>
                                    Bayar ({detail.payment_method_label})
                                </span>
                                <span>
                                    {formatRupiah(
                                        isCash
                                            ? (detail.paid_amount ?? 0)
                                            : detail.total,
                                    )}
                                </span>
                            </div>
                            {isCash && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Kembalian</span>
                                    <span>
                                        {formatRupiah(
                                            detail.change_amount ?? 0,
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>

                        {waEnabledNoPhone && (
                            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-500">
                                Transaksi ini tidak memiliki nomor WhatsApp
                                pelanggan — struk tidak dapat dikirim ulang.
                            </p>
                        )}
                        {waError && (
                            <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
                                {waError}
                            </p>
                        )}

                        {/* Aksi */}
                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            {canCancel && detail.status === 'paid' && (
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 font-medium text-red-600 transition-colors hover:bg-red-50"
                                >
                                    <BanIcon className="h-4 w-4" />
                                    Batalkan
                                </button>
                            )}
                            {/* Kirim ulang struk via WhatsApp (Fase 16) —
                                muncul bila setting ON & nomor terisi */}
                            <WhatsappButton
                                receipt={detail}
                                onError={setWaError}
                                label="Kirim WhatsApp"
                                className="inline-flex items-center gap-2 rounded-xl border border-[#25D366] bg-white px-4 py-2.5 font-medium text-[#128C7E] transition-colors hover:bg-[#25D366]/10"
                            />
                            <button
                                type="button"
                                onClick={onReprint}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <PrinterIcon className="h-4 w-4" />
                                Cetak Ulang
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                            >
                                Tutup
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
