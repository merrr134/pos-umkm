<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><title>{{ $title }}</title></head>
<body>
@include('reports.partials.header')

<table class="report">
    <thead>
        <tr>
            <th>Nomor</th>
            <th>Tanggal</th>
            <th>Kategori</th>
            <th>Judul</th>
            <th class="num">Nominal</th>
            <th>Metode</th>
        </tr>
    </thead>
    <tbody>
        @forelse ($expenses as $expense)
            <tr>
                <td>{{ $expense->expense_number }}</td>
                <td>{{ $expense->expense_date->format('d/m/Y') }}</td>
                <td>{{ $expense->category->name }}</td>
                <td>{{ $expense->title }}</td>
                <td class="num">{{ number_format($expense->amount, 0, ',', '.') }}</td>
                <td>{{ $methodLabels[$expense->payment_method] ?? $expense->payment_method }}</td>
            </tr>
        @empty
            <tr><td colspan="6" class="empty">Belum ada data untuk periode ini.</td></tr>
        @endforelse
    </tbody>
</table>

<p class="summary">
    Jumlah pengeluaran: {{ $expenses->count() }} &nbsp;·&nbsp;
    Total: Rp {{ number_format($expenses->sum('amount'), 0, ',', '.') }}
</p>
</body>
</html>
