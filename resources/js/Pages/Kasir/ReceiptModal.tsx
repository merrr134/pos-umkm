import { CheckCircleIcon } from '@/Components/Icons';
import Modal from '@/Components/Modal';
import { SuccessBurst } from '@/Components/motion';
import PrintButton from '@/Components/PrintButton';
import WhatsappButton from '@/Components/WhatsappButton';
import { normalizePhone } from '@/lib/whatsapp';
import { PageProps } from '@/types';
import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ReceiptProfile, ReceiptTransaction } from './kasir';

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Kolom bersama tabel info transaksi — nilai 36mm rata kanan. */
function InfoCols() {
    return (
        <colgroup>
            <col />
            <col className="receipt-col-value" />
        </colgroup>
    );
}

/** Kolom bersama tabel nominal (item & ringkasan) — angka 19mm. */
function AmountCols() {
    return (
        <colgroup>
            <col />
            <col className="receipt-col-amount" />
        </colgroup>
    );
}

/**
 * Struk thermal 58mm — table-based dengan table-layout FIXED
 * (kompatibilitas printer thermal, PRD 5.5). Seluruh gaya dari
 * kelas .receipt di app.css: satu font monospace, satu line-height,
 * kolom deterministik — logo & telepon murni baris header tambahan
 * dan tidak memengaruhi layout isi struk.
 */
export function Receipt({
    receipt,
    profile,
}: {
    receipt: ReceiptTransaction;
    profile: ReceiptProfile;
}) {
    const isCash = receipt.payment_method === 'tunai';

    return (
        <div className="receipt">
            {/* Header — logo di LUAR tabel agar tidak memengaruhi
                perhitungan kolom; telepon tepat di bawah nama toko */}
            {profile.logo && (
                <img
                    src={profile.logo}
                    alt={profile.name}
                    className="receipt-logo"
                />
            )}
            <div className="receipt-center receipt-store">{profile.name}</div>
            {profile.phone && (
                <div className="receipt-center">Telp: {profile.phone}</div>
            )}
            {profile.address && (
                <div className="receipt-center">{profile.address}</div>
            )}

            <hr className="receipt-sep" />

            {/* Info transaksi */}
            <table>
                <InfoCols />
                <tbody>
                    <tr>
                        <td>No</td>
                        <td className="receipt-num">
                            {receipt.invoice_number}
                        </td>
                    </tr>
                    <tr>
                        <td>Tanggal</td>
                        <td className="receipt-num">
                            {formatDateTime(receipt.date)}
                        </td>
                    </tr>
                    <tr>
                        <td>Kasir</td>
                        <td className="receipt-num">{receipt.kasir}</td>
                    </tr>
                </tbody>
            </table>

            <hr className="receipt-sep" />

            {/* Daftar item */}
            <table>
                <AmountCols />
                <tbody>
                    {receipt.items.map((item, index) => (
                        <tr key={index} className="receipt-item">
                            <td>
                                {item.product_name}
                                {item.note && (
                                    <>
                                        <br />
                                        <span className="receipt-note">
                                            &nbsp;&nbsp;* {item.note}
                                        </span>
                                    </>
                                )}
                                <br />
                                {item.quantity} x{' '}
                                {item.price.toLocaleString('id-ID')}
                            </td>
                            <td className="receipt-num">
                                {item.subtotal.toLocaleString('id-ID')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <hr className="receipt-sep" />

            {/* Ringkasan — baris pajak tidak muncul jika pajak OFF */}
            <table>
                <AmountCols />
                <tbody>
                    <tr>
                        <td>Subtotal</td>
                        <td className="receipt-num">
                            {receipt.subtotal.toLocaleString('id-ID')}
                        </td>
                    </tr>
                    {receipt.discount > 0 && (
                        <tr>
                            <td>Diskon</td>
                            <td className="receipt-num">
                                -{receipt.discount.toLocaleString('id-ID')}
                            </td>
                        </tr>
                    )}
                    {receipt.tax_name !== null && (
                        <tr>
                            <td>
                                {receipt.tax_name} ({receipt.tax_percent}%)
                            </td>
                            <td className="receipt-num">
                                {receipt.tax_amount.toLocaleString('id-ID')}
                            </td>
                        </tr>
                    )}
                    {receipt.rounding !== 0 && (
                        <tr>
                            <td>Pembulatan</td>
                            <td className="receipt-num">
                                {receipt.rounding > 0 ? '' : '-'}
                                {Math.abs(receipt.rounding).toLocaleString(
                                    'id-ID',
                                )}
                            </td>
                        </tr>
                    )}
                    <tr className="receipt-total">
                        <td>TOTAL</td>
                        <td className="receipt-num">
                            {receipt.total.toLocaleString('id-ID')}
                        </td>
                    </tr>
                    <tr>
                        <td>Bayar ({receipt.payment_method_label})</td>
                        <td className="receipt-num">
                            {(isCash
                                ? (receipt.paid_amount ?? 0)
                                : receipt.total
                            ).toLocaleString('id-ID')}
                        </td>
                    </tr>
                    {isCash && (
                        <tr>
                            <td>Kembalian</td>
                            <td className="receipt-num">
                                {(receipt.change_amount ?? 0).toLocaleString(
                                    'id-ID',
                                )}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Footer Struk dari Profil Toko */}
            {profile.footer && (
                <>
                    <hr className="receipt-sep" />
                    <div className="receipt-center">{profile.footer}</div>
                </>
            )}
        </div>
    );
}

/**
 * Preview struk + salinan cetak yang di-portal ke <body>.
 * Salinan inilah (#receipt-print) yang dicetak — di luar modal,
 * sehingga transform/overflow-hidden milik DialogPanel tidak
 * memotong atau menggeser hasil print. Preview dan cetak memakai
 * komponen & kelas yang sama persis → hasil identik.
 */
export function ReceiptPreview({
    receipt,
    profile,
}: {
    receipt: ReceiptTransaction;
    profile: ReceiptProfile;
}) {
    return (
        <>
            <Receipt receipt={receipt} profile={profile} />
            {createPortal(
                <div id="receipt-print" className="receipt-print-root">
                    <Receipt receipt={receipt} profile={profile} />
                </div>,
                document.body,
            )}
        </>
    );
}

interface ReceiptModalProps {
    show: boolean;
    receipt: ReceiptTransaction | null;
    profile: ReceiptProfile;
    onDone: () => void;
}

export default function ReceiptModal({
    show,
    receipt,
    profile,
    onDone,
}: ReceiptModalProps) {
    const { whatsapp } = usePage<PageProps>().props;
    const [waError, setWaError] = useState<string | null>(null);

    if (receipt === null) return null;

    // Setting ON tapi nomor kosong → beri tahu (PRD Fase 16 §9)
    const waEnabledNoPhone =
        whatsapp.enabled && normalizePhone(receipt.customer_phone) === '';

    return (
        <Modal show={show} onClose={onDone} maxWidth="sm">
            <div className="p-6">
                <div className="flex items-center gap-3">
                    {/* Success animation — checkmark + confetti (Fase 13) */}
                    <SuccessBurst>
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                            <CheckCircleIcon className="h-6 w-6" />
                        </span>
                    </SuccessBurst>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Transaksi Berhasil
                        </h2>
                        <p className="text-sm text-slate-500">
                            {receipt.invoice_number}
                        </p>
                    </div>
                </div>

                {/* Preview struk sebelum print (PRD 5.5) */}
                <div className="mt-4 max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 py-4">
                    <div className="shadow-sm">
                        <ReceiptPreview receipt={receipt} profile={profile} />
                    </div>
                </div>

                {/* Kirim struk digital via WhatsApp (Fase 16) */}
                {waEnabledNoPhone && (
                    <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        Nomor WhatsApp pelanggan tidak diisi — struk tidak dapat
                        dikirim via WhatsApp.
                    </p>
                )}
                {waError && (
                    <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                        {waError}
                    </p>
                )}

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                        type="button"
                        onClick={onDone}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        Selesai
                    </button>
                    <WhatsappButton receipt={receipt} onError={setWaError} />
                    <PrintButton receipt={receipt} profile={profile} />
                </div>
            </div>
        </Modal>
    );
}
