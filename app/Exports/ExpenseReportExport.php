<?php

namespace App\Exports;

use App\Models\Expense;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;

/** Export Excel Laporan Pengeluaran (Fase 10) — mengikuti filter aktif. */
class ExpenseReportExport implements FromCollection, ShouldAutoSize, WithHeadings
{
    private const METHOD_LABELS = [
        'tunai' => 'Tunai',
        'qris' => 'QRIS',
        'transfer' => 'Transfer Bank',
        'kartu' => 'Kartu Debit/Kredit',
    ];

    /** @param Builder<Expense> $query */
    public function __construct(private readonly Builder $query) {}

    /** @return array<int, string> */
    public function headings(): array
    {
        return ['Nomor', 'Tanggal', 'Kategori', 'Judul', 'Nominal', 'Metode'];
    }

    /** @return Collection<int, array<int, mixed>> */
    public function collection(): Collection
    {
        return $this->query->get()->map(fn (Expense $expense) => [
            $expense->expense_number,
            $expense->expense_date->format('d/m/Y'),
            $expense->category->name,
            $expense->title,
            $expense->amount,
            self::METHOD_LABELS[$expense->payment_method] ?? $expense->payment_method,
        ]);
    }
}
