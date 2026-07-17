<?php

namespace App\Exports;

use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;

/**
 * Export Excel Laporan Stok (Fase 10) — mengikuti filter aktif.
 * Nilai Persediaan = stock × cost_price (cost null dihitung 0).
 */
class StockReportExport implements FromCollection, ShouldAutoSize, WithHeadings
{
    /** @param Builder<Product> $query */
    public function __construct(private readonly Builder $query) {}

    /** @return array<int, string> */
    public function headings(): array
    {
        return [
            'Produk', 'Kategori', 'Stok', 'Minimum', 'Status',
            'Harga Modal', 'Harga Jual', 'Nilai Persediaan',
        ];
    }

    /** @return Collection<int, array<int, mixed>> */
    public function collection(): Collection
    {
        return $this->query->get()->map(fn (Product $product) => [
            $product->name,
            $product->category->name,
            $product->track_stock ? $product->stock : '-',
            $product->track_stock ? $product->min_stock : '-',
            $product->status === Product::STATUS_AKTIF ? 'Aktif' : 'Habis',
            $product->cost_price ?? 0,
            $product->price,
            $product->stock * ($product->cost_price ?? 0),
        ]);
    }
}
