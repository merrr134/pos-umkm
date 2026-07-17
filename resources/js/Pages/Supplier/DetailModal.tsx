import Modal from '@/Components/Modal';
import { formatSupplierDate, SupplierRow } from './supplier';
import StatusBadge from './StatusBadge';

function Row({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-900">
                {value !== null && value !== '' ? value : '—'}
            </dd>
        </div>
    );
}

/** Modal Detail Supplier (Fase 8) — seluruh informasi supplier. */
export default function DetailModal({
    supplier,
    onClose,
}: {
    supplier: SupplierRow | null;
    onClose: () => void;
}) {
    return (
        <Modal show={supplier !== null} onClose={onClose} maxWidth="lg">
            <div className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Detail Supplier
                        </h2>
                        <p className="text-sm font-semibold text-[#0A45FE]">
                            {supplier?.code}
                        </p>
                    </div>
                    {supplier && <StatusBadge status={supplier.status} />}
                </div>

                {supplier?.deleted_at && (
                    <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
                        Supplier ini telah dihapus pada{' '}
                        {formatSupplierDate(supplier.deleted_at)}.
                    </p>
                )}

                <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                    <Row label="Nama Supplier" value={supplier?.name ?? null} />
                    <Row
                        label="Kontak Person"
                        value={supplier?.contact_person ?? null}
                    />
                    <Row label="Telepon" value={supplier?.phone ?? null} />
                    <Row label="Email" value={supplier?.email ?? null} />
                    <div className="sm:col-span-2">
                        <Row label="Alamat" value={supplier?.address ?? null} />
                    </div>
                    <div className="sm:col-span-2">
                        <Row label="Catatan" value={supplier?.notes ?? null} />
                    </div>
                    <Row
                        label="Terdaftar"
                        value={formatSupplierDate(supplier?.created_at ?? null)}
                    />
                </dl>

                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </Modal>
    );
}
