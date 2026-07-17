/**
 * Skeleton loading (PRD Bab 10, Fase 12) — menyerupai layout final
 * agar transisi mulus. Dipakai saat navigasi filter/search/pagination.
 */

/** Baris skeleton untuk tabel ber-gaya kartu (border-spacing). */
export function SkeletonRows({
    rows = 6,
    cols,
}: {
    rows?: number;
    cols: number;
}) {
    return (
        <>
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="animate-pulse">
                    {Array.from({ length: cols }).map((_, colIndex) => (
                        <td
                            key={colIndex}
                            className="border-y border-slate-200 bg-white px-4 py-5 first:rounded-l-xl first:border-l last:rounded-r-xl last:border-r"
                        >
                            <div
                                className="shimmer h-4 rounded-lg bg-slate-100"
                                style={{
                                    width: `${55 + ((rowIndex * 7 + colIndex * 13) % 40)}%`,
                                }}
                            />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

/** Kartu skeleton untuk grid produk Kasir. */
export function SkeletonCards({ count = 8 }: { count?: number }) {
    return (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                    <div className="shimmer aspect-square bg-slate-100" />
                    <div className="space-y-2 p-3">
                        <div className="shimmer h-4 w-3/4 rounded-lg bg-slate-100" />
                        <div className="shimmer h-4 w-1/2 rounded-lg bg-slate-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}
