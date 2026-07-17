import Modal from '@/Components/Modal';
import { formatRupiah } from '@/Pages/Kasir/kasir';
import { formatPurchaseDate, PurchaseDetail } from './pembelian';

/** Modal Detail Pembelian (Fase 9) — informasi purchase + daftar item. */
export default function DetailModal({
    show,
    detail,
    loading,
    onClose,
}: {
    show: boolean;
    detail: PurchaseDetail | null;
    loading: boolean;
    onClose: () => void;
}) {
    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <div className="max-h-[90vh] overflow-y-auto p-6">
                {loading || detail === null ? (
                    /* Skeleton loading (PRD Bab 10) */
                    <div className="animate-pulse space-y-4">
                        <div className="h-6 w-48 rounded-lg bg-slate-200" />
                        <div className="h-4 w-64 rounded-lg bg-slate-100" />
                        <div className="h-32 rounded-xl bg-slate-100" />
                    </div>
                ) : (
                    <>
                        <h2 className="text-lg font-bold text-slate-900">
                            Detail Pembelian
                        </h2>
                        <p className="text-sm font-semibold text-[#0A45FE]">
                            {detail.invoice_number}
                        </p>

                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                            <div>
                                <dt className="text-slate-500">Tanggal</dt>
                                <dd className="font-medium text-slate-900">
                                    {formatPurchaseDate(detail.purchase_date)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-500">Supplier</dt>
                                <dd className="font-medium text-slate-900">
                                    {detail.supplier.name}
                                    <span className="ms-1 text-xs text-slate-500">
                                        ({detail.supplier.code})
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-500">Dicatat oleh</dt>
                                <dd className="font-medium text-slate-900">
                                    {detail.user}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-500">Jumlah Item</dt>
                                <dd className="font-medium text-slate-900">
                                    {detail.items.length} produk
                                </dd>
                            </div>
                        </dl>

                        {/* Daftar item */}
                        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                        <th className="px-4 py-2.5 font-medium">
                                            Produk
                                        </th>
                                        <th className="px-4 py-2.5 text-center font-medium">
                                            Qty
                                        </th>
                                        <th className="px-4 py-2.5 text-right font-medium">
                                            Harga Modal
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
                                            <td className="px-4 py-2.5 font-medium text-slate-900">
                                                {item.product}
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-slate-700">
                                                {item.quantity}
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-slate-700">
                                                {formatRupiah(item.cost_price)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                                                {formatRupiah(item.subtotal)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Ringkasan */}
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
                            {detail.tax > 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Pajak</span>
                                    <span>{formatRupiah(detail.tax)}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                                <span>Total</span>
                                <span>{formatRupiah(detail.total)}</span>
                            </div>
                        </div>

                        {detail.notes && (
                            <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                                <p className="text-slate-500">Catatan:</p>
                                <p className="mt-0.5 font-medium text-slate-800">
                                    {detail.notes}
                                </p>
                            </div>
                        )}

                        <div className="mt-6 flex justify-end">
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
