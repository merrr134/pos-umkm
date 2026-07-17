<?php

namespace App\Exports;

use App\Models\Transaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;

/** Export Excel Laporan Penjualan (Fase 10) — mengikuti filter aktif. */
class SalesReportExport implements FromCollection, ShouldAutoSize, WithHeadings
{
    /** @param Builder<Transaction> $query */
    public function __construct(private readonly Builder $query) {}

    /** @return array<int, string> */
    public function headings(): array
    {
        return [
            'Nomor', 'Tanggal', 'Kasir', 'Item', 'Subtotal',
            'Diskon', 'Pajak', 'Total', 'Status',
        ];
    }

    /** @return Collection<int, array<int, mixed>> */
    public function collection(): Collection
    {
        return $this->query->get()->map(fn (Transaction $transaction) => [
            $transaction->invoice_number,
            $transaction->created_at->format('d/m/Y H:i'),
            $transaction->user->name,
            $transaction->items_count,
            $transaction->subtotal,
            $transaction->discount,
            $transaction->tax_amount,
            $transaction->total,
            $transaction->status === Transaction::STATUS_PAID ? 'Lunas' : 'Dibatalkan',
        ]);
    }
}
