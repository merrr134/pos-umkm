import { SVGAttributes } from 'react';

/**
 * Logo mark Pitou Cafe — bar vertikal biru/hijau sesuai desain
 * (docs/design/login.png).
 */
export default function PitouLogo(props: SVGAttributes<SVGElement>) {
    return (
        <svg viewBox="0 0 40 40" fill="none" {...props}>
            <rect x="4" y="4" width="7" height="26" rx="3.5" fill="#0A45FE" />
            <rect x="15" y="10" width="7" height="14" rx="3.5" fill="#22C55E" />
            <circle cx="18.5" cy="31.5" r="3.5" fill="#A3E635" />
            <rect x="26" y="6" width="7" height="20" rx="3.5" fill="#0A45FE" />
        </svg>
    );
}
