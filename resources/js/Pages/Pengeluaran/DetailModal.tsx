import Modal from '@/Components/Modal';
import { formatRupiah } from '@/Pages/Kasir/kasir';
import { ExpenseRow, formatExpenseDate } from './pengeluaran';

/**
 * Modal Detail Pengeluaran (Fase 9) — seluruh informasi + preview
 * bukti (gambar) atau link unduh (PDF).
 */
export default function DetailModal({
    show,
    expense,
    methodLabel,
    onClose,
}: {
    show: boolean;
    expense: ExpenseRow | null;
    methodLabel: (code: string) => string;
    onClose: () => void;
}) {
    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <div className="max-h-[90vh] overflow-y-auto p-6">
                {expense === null ? null : (
                    <>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Detail Pengeluaran
                                </h2>
                                <p className="text-sm font-semibold text-[#0A45FE]">
                                    {expense.expense_number}
                                </p>
                            </div>
                            {expense.deleted_at !== null && (
                                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                                    Terhapus
                                </span>
                            )}
                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                            <div>
                                <dt className="text-slate-500">Tanggal</dt>
                                <dd className="font-medium text-slate-900">
                                    {formatExpenseDate(expense.expense_date)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-500">Kategori</dt>
                                <dd className="font-medium text-slate-900">
                                    {expense.category}
                                </dd>
                            </div>
                            <div className="col-span-2">
                                <dt className="text-slate-500">Judul</dt>
                                <dd className="font-medium text-slate-900">
                                    {expense.title}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-500">Nominal</dt>
                                <dd className="text-base font-bold text-slate-900">
                                    {formatRupiah(expense.amount)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-500">
                                    Metode Pembayaran
                                </dt>
                                <dd className="font-medium text-slate-900">
                                    {methodLabel(expense.payment_method)}
                                </dd>
                            </div>
                            <div className="col-span-2">
                                <dt className="text-slate-500">Dicatat oleh</dt>
                                <dd className="font-medium text-slate-900">
                                    {expense.user}
                                </dd>
                            </div>
                        </dl>

                        {expense.notes && (
                            <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                                <p className="text-slate-500">Catatan:</p>
                                <p className="mt-0.5 font-medium text-slate-800">
                                    {expense.notes}
                                </p>
                            </div>
                        )}

                        {/* Bukti — preview gambar / link unduh PDF */}
                        <div className="mt-4">
                            <p className="font-medium text-slate-900">
                                Bukti Pengeluaran
                            </p>
                            {expense.receipt_url === null ? (
                                <p className="mt-2 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
                                    Tidak ada bukti terlampir.
                                </p>
                            ) : expense.receipt_is_pdf ? (
                                <a
                                    href={expense.receipt_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-[#0A45FE] hover:bg-blue-50/40"
                                >
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-50 text-xs font-bold uppercase text-red-500">
                                        PDF
                                    </span>
                                    <span className="font-medium text-[#0A45FE]">
                                        Lihat / unduh bukti PDF
                                    </span>
                                </a>
                            ) : (
                                <a
                                    href={expense.receipt_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 block"
                                    title="Buka bukti di tab baru"
                                >
                                    <img
                                        src={expense.receipt_url}
                                        alt={`Bukti ${expense.expense_number}`}
                                        className="max-h-72 w-full rounded-xl border border-slate-200 object-contain"
                                    />
                                </a>
                            )}
                        </div>

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
