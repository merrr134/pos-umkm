{{-- Header laporan PDF — nama cafe dari Profil Toko (PRD 5.12) --}}
<style>
    * { font-family: DejaVu Sans, sans-serif; }
    body { font-size: 11px; color: #1e293b; margin: 24px; }
    .report-header { border-bottom: 2px solid #0A45FE; padding-bottom: 8px; margin-bottom: 14px; }
    .store-name { font-size: 16px; font-weight: bold; color: #0A45FE; margin: 0; }
    .report-title { font-size: 13px; font-weight: bold; margin: 4px 0 0; }
    .report-meta { color: #64748b; margin: 2px 0 0; }
    table.report { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table.report th { background: #f1f5f9; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10px; text-transform: uppercase; }
    table.report td { padding: 5px 8px; border: 1px solid #e2e8f0; }
    .num { text-align: right; }
    .center { text-align: center; }
    .summary { margin-top: 12px; font-weight: bold; }
    .empty { text-align: center; color: #94a3b8; padding: 18px; }
</style>
<div class="report-header">
    <p class="store-name">{{ $storeName }}</p>
    <p class="report-title">{{ $title }}</p>
    <p class="report-meta">Periode: {{ $period }} &nbsp;·&nbsp; Dicetak: {{ now()->format('d/m/Y H:i') }}</p>
</div>
