<?php

namespace App\Exports;

use App\Models\Purchase;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;

/** Export Excel Laporan Pembelian (Fase 10) — mengikuti filter aktif. */
class PurchaseReportExport implements FromCollection, ShouldAutoSize, WithHeadings
{
    /** @param Builder<Purchase> $query */
    public function __construct(private readonly Builder $query) {}

    /** @return array<int, string> */
    public function headings(): array
    {
        return ['Nomor', 'Tanggal', 'Supplier', 'Jumlah Item', 'Total'];
    }

    /** @return Collection<int, array<int, mixed>> */
    public function collection(): Collection
    {
        return $this->query->get()->map(fn (Purchase $purchase) => [
            $purchase->invoice_number,
            $purchase->purchase_date->format('d/m/Y'),
            $purchase->supplier->name,
            $purchase->items_count,
            $purchase->total,
        ]);
    }
}
