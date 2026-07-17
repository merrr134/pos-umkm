import {
    AlertTriangleIcon,
    BanknoteIcon,
    CreditCardIcon,
    LandmarkIcon,
    QrCodeIcon,
} from '@/Components/Icons';
import Modal from '@/Components/Modal';
import { createOfflineTransaction } from '@/lib/offline/offlineTransaction';
import { normalizePhone } from '@/lib/whatsapp';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivePaymentMethod,
    calculateRounding,
    CartItem,
    DiscountType,
    formatRupiah,
    ReceiptTransaction,
    TaxSettings,
} from './kasir';

const methodIcons: Record<
    string,
    (props: { className?: string }) => JSX.Element
> = {
    tunai: BanknoteIcon,
    qris: QrCodeIcon,
    transfer: LandmarkIcon,
    kartu: CreditCardIcon,
};

/** Shortcut denominasi uang tunai (PRD 5.3). */
const CASH_SHORTCUTS = [20000, 50000, 100000, 200000, 500000];

interface PaymentModalProps {
    show: boolean;
    cart: CartItem[];
    discountType: DiscountType;
    discountValue: string;
    subtotal: number;
    discount: number;
    tax: number;
    taxSettings: TaxSettings;
    paymentMethods: ActivePaymentMethod[];
    /** Fase 15 — status koneksi: offline → transaksi masuk antrean. */
    online: boolean;
    /** Nama kasir untuk struk lokal transaksi offline. */
    kasirName: string;
    onClose: () => void;
    onSuccess: (receipt: ReceiptTransaction, offline: boolean) => void;
}

export default function PaymentModal({
    show,
    cart,
    discountType,
    discountValue,
    subtotal,
    discount,
    tax,
    taxSettings,
    paymentMethods,
    online,
    kasirName,
    onClose,
    onSuccess,
}: PaymentModalProps) {
    const [methodCode, setMethodCode] = useState<string>(
        paymentMethods[0]?.code ?? 'tunai',
    );
    const [cash, setCash] = useState('');
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Total akhir = (subtotal − diskon + pajak) + pembulatan (PRD 5.3)
    const totalBeforeRounding = subtotal - discount + tax;
    const rounding = calculateRounding(
        totalBeforeRounding,
        taxSettings.rounding_method,
    );
    const total = totalBeforeRounding + rounding;

    const isCash = methodCode === 'tunai';
    const cashAmount = Number(cash) || 0;
    const change = cashAmount - total;
    const cashInsufficient = isCash && cashAmount < total;

    // Reset form setiap modal dibuka
    useEffect(() => {
        if (show) {
            setMethodCode(paymentMethods[0]?.code ?? 'tunai');
            setCash('');
            setPhone('');
            setError(null);
        }
    }, [show, paymentMethods]);

    const payload = useMemo(
        () => ({
            items: cart.map((item) => ({
                product_id: item.product.id,
                quantity: item.qty,
                note: item.note !== '' ? item.note : null,
            })),
            discount_type: Number(discountValue) > 0 ? discountType : null,
            discount_value: Number(discountValue) > 0 ? discountValue : null,
        }),
        [cart, discountType, discountValue],
    );

    const methodLabel =
        paymentMethods.find((method) => method.code === methodCode)?.name ??
        methodCode;

    // Nomor WhatsApp dinormalisasi (08…→628…) sebelum disimpan (Fase 16);
    // kosong → null (checkout tetap boleh tanpa nomor).
    const normalizedPhone = normalizePhone(phone);
    const phoneToSave = normalizedPhone !== '' ? normalizedPhone : null;

    /** Bangun struk offline lokal + masukkan ke antrean sinkronisasi. */
    const submitOffline = async (): Promise<void> => {
        const receipt = await createOfflineTransaction({
            cart,
            discountType,
            discountValue,
            subtotal,
            discount,
            tax,
            rounding,
            total,
            taxSettings,
            methodCode,
            methodLabel,
            paidAmount: isCash ? cashAmount : null,
            customerPhone: phoneToSave,
            kasirName,
        });

        onSuccess(receipt, true);
    };

    const submit = async () => {
        if (saving || cart.length === 0 || (isCash && cashInsufficient)) {
            return;
        }

        setSaving(true);
        setError(null);

        // Offline (PRD 5.14) — transaksi disimpan lokal status pending,
        // TIDAK dikirim ke server; sinkronisasi otomatis saat online.
        if (!online) {
            try {
                await submitOffline();
            } catch {
                setError(
                    'Gagal menyimpan transaksi offline. Penyimpanan lokal (IndexedDB) bermasalah.',
                );
            } finally {
                setSaving(false);
            }
            return;
        }

        try {
            const response = await axios.post(route('kasir.bayar'), {
                ...payload,
                payment_method: methodCode,
                paid_amount: isCash ? cashAmount : null,
                customer_phone: phoneToSave,
            });

            onSuccess(response.data.transaction as ReceiptTransaction, false);
        } catch (err) {
            const response = (
                err as {
                    response?: {
                        status?: number;
                        data?: { errors?: Record<string, string[]> };
                    };
                    request?: unknown;
                }
            ).response;

            if (response?.status === 422 && response.data?.errors) {
                setError(Object.values(response.data.errors)[0]?.[0] ?? null);
            } else if (response === undefined) {
                // Koneksi putus di tengah request → fallback ke antrean
                // offline supaya transaksi tidak hilang (PRD Bab 9)
                try {
                    await submitOffline();
                } catch {
                    setError(
                        'Transaksi gagal disimpan dan penyimpanan offline bermasalah. Coba lagi.',
                    );
                }
            } else {
                setError('Transaksi gagal disimpan. Silakan coba lagi.');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal show={show} onClose={() => !saving && onClose()} maxWidth="md">
            <div className="p-6">
                <h2 className="text-lg font-bold text-slate-900">Pembayaran</h2>
                <p className="text-sm text-slate-500">
                    Periksa rincian lalu pilih metode pembayaran.
                </p>

                {/* Mode offline (Fase 15) — transaksi masuk antrean */}
                {!online && (
                    <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                        <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                        Anda sedang offline. Transaksi disimpan lokal dan
                        disinkronkan otomatis saat koneksi kembali.
                    </p>
                )}

                {/* Ringkasan: Subtotal → Diskon → Pajak → Pembulatan → Total */}
                <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-medium text-slate-900">
                            {formatRupiah(subtotal)}
                        </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                        <span>Diskon</span>
                        <span
                            className={
                                'font-medium ' +
                                (discount > 0
                                    ? 'text-red-600'
                                    : 'text-slate-900')
                            }
                        >
                            {discount > 0 ? '− ' : ''}
                            {formatRupiah(discount)}
                        </span>
                    </div>
                    {taxSettings.enabled && (
                        <div className="flex justify-between text-slate-600">
                            <span>
                                {taxSettings.name} ({taxSettings.percent}%)
                            </span>
                            <span className="font-medium text-slate-900">
                                {formatRupiah(tax)}
                            </span>
                        </div>
                    )}
                    {rounding !== 0 && (
                        <div className="flex justify-between text-slate-600">
                            <span>Pembulatan</span>
                            <span className="font-medium text-slate-900">
                                {rounding > 0 ? '+' : '−'}{' '}
                                {formatRupiah(Math.abs(rounding))}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                        <span className="font-bold text-slate-900">Total</span>
                        <span className="text-lg font-extrabold text-[#0A45FE]">
                            {formatRupiah(total)}
                        </span>
                    </div>
                </div>

                {/* Metode pembayaran — hanya yang aktif (PRD 5.13.C) */}
                <p className="mt-4 text-sm font-medium text-slate-900">
                    Metode Pembayaran
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                    {paymentMethods.map((method) => {
                        const Icon =
                            methodIcons[method.code] ?? CreditCardIcon;
                        const active = methodCode === method.code;

                        return (
                            <button
                                key={method.id}
                                type="button"
                                onClick={() => setMethodCode(method.code)}
                                className={
                                    'flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors ' +
                                    (active
                                        ? 'border-[#0A45FE] bg-blue-50 text-[#0A45FE]'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                                }
                            >
                                <Icon className="h-5 w-5 shrink-0" />
                                <span className="truncate">{method.name}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Tunai: input uang + shortcut + kembalian realtime.
                    Non-tunai: field uang disembunyikan (PRD 5.3) */}
                {isCash && (
                    <div className="mt-4">
                        <label
                            htmlFor="cash-amount"
                            className="block text-sm font-medium text-slate-900"
                        >
                            Uang Pelanggan
                        </label>
                        <input
                            id="cash-amount"
                            type="number"
                            min={0}
                            value={cash}
                            placeholder="0"
                            className="mt-2 block w-full rounded-xl border-slate-200 px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-[#0A45FE] focus:ring-[#0A45FE]"
                            onChange={(e) => setCash(e.target.value)}
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setCash(String(total))}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-[#0A45FE]/40 hover:text-[#0A45FE]"
                            >
                                Uang Pas
                            </button>
                            {CASH_SHORTCUTS.map((amount) => (
                                <button
                                    key={amount}
                                    type="button"
                                    onClick={() => setCash(String(amount))}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-[#0A45FE]/40 hover:text-[#0A45FE]"
                                >
                                    {amount.toLocaleString('id-ID')}
                                </button>
                            ))}
                        </div>

                        {cash !== '' &&
                            (cashInsufficient ? (
                                <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                                    <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                                    Uang pelanggan kurang{' '}
                                    {formatRupiah(total - cashAmount)}.
                                </p>
                            ) : (
                                <div className="mt-3 flex items-center justify-between rounded-xl bg-green-50 px-3.5 py-2.5">
                                    <span className="text-sm font-medium text-green-800">
                                        Kembalian
                                    </span>
                                    <span className="text-lg font-bold text-green-700">
                                        {formatRupiah(change)}
                                    </span>
                                </div>
                            ))}
                    </div>
                )}

                {/* Nomor WhatsApp pelanggan (opsional) — struk digital Fase 16 */}
                <div className="mt-4">
                    <label
                        htmlFor="customer-phone"
                        className="block text-sm font-medium text-slate-900"
                    >
                        Nomor WhatsApp Pelanggan{' '}
                        <span className="font-normal text-slate-400">
                            (opsional)
                        </span>
                    </label>
                    <input
                        id="customer-phone"
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        placeholder="Contoh: 081234567890"
                        className="mt-2 block w-full rounded-xl border-slate-200 px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-[#0A45FE] focus:ring-[#0A45FE]"
                        // Hanya angka (Fase 16); normalisasi 08→628 saat simpan
                        onChange={(e) =>
                            setPhone(e.target.value.replace(/[^\d]/g, ''))
                        }
                    />
                    {normalizedPhone !== '' && (
                        <p className="mt-1.5 text-xs text-slate-400">
                            Akan disimpan sebagai {normalizedPhone}
                        </p>
                    )}
                </div>

                {error && (
                    <p className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                        <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                        {error}
                    </p>
                )}

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        disabled={
                            saving ||
                            cart.length === 0 ||
                            (isCash && cashInsufficient)
                        }
                        onClick={submit}
                        className="rounded-xl bg-[#0A45FE] px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving
                            ? 'Menyimpan...'
                            : online
                              ? 'Simpan'
                              : 'Simpan Offline'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
