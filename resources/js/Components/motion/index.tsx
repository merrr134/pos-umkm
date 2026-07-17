import {
    animate,
    AnimatePresence,
    motion,
    useReducedMotion,
} from 'framer-motion';
import { PropsWithChildren, useEffect, useRef, useState } from 'react';

/**
 * Komponen animasi reusable (Fase 13 — PRD Bab 14). Satu sistem:
 * Framer Motion. Semua durasi ≤ 300ms, hanya transform + opacity.
 * prefers-reduced-motion dihormati global lewat <MotionConfig
 * reducedMotion="user"> di app.tsx (transform dimatikan, fade tetap)
 * + pengecekan eksplisit di animasi kompleks.
 */

/** MotionCard — fade-up saat muncul; delay untuk efek stagger. */
export function FadeUp({
    children,
    delay = 0,
    className,
}: PropsWithChildren<{ delay?: number; className?: string }>) {
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay, ease: 'easeOut' }}
        >
            {children}
        </motion.div>
    );
}

/** Item grid produk — stagger ringan berdasarkan posisi di halaman. */
export function GridItem({
    children,
    index,
    className,
}: PropsWithChildren<{ index: number; className?: string }>) {
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.2,
                delay: Math.min(index, 11) * 0.03,
                ease: 'easeOut',
            }}
        >
            {children}
        </motion.div>
    );
}

/**
 * MotionCounter — count-up hanya saat nilai BERUBAH (render pertama
 * tampil langsung, tanpa animasi). Reduce Motion → lompat instan.
 */
export function CountUp({
    value,
    format,
}: {
    value: number;
    format: (value: number) => string;
}) {
    const reduced = useReducedMotion();
    const [display, setDisplay] = useState(value);
    const previous = useRef(value);

    useEffect(() => {
        const from = previous.current;
        previous.current = value;

        if (from === value) {
            return;
        }

        if (reduced) {
            setDisplay(value);
            return;
        }

        const controls = animate(from, value, {
            duration: 0.25,
            ease: 'easeOut',
            onUpdate: (latest) => setDisplay(Math.round(latest)),
        });

        return () => controls.stop();
    }, [value, reduced]);

    return <span>{format(display)}</span>;
}

/** Pop kecil saat angka berubah (qty keranjang). */
export function NumberPop({
    value,
    className,
}: {
    value: number;
    className?: string;
}) {
    return (
        <motion.span
            key={value}
            className={className}
            initial={{ opacity: 0.4, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
        >
            {value}
        </motion.span>
    );
}

/**
 * MotionToast — slide dari kanan atas + exit animation.
 * Pembungkus seluruh toast aplikasi (sukses/gagal).
 */
export function ToastShell({
    show,
    className,
    children,
}: PropsWithChildren<{ show: boolean; className?: string }>) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    role="status"
                    className={className}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/** Sudut ledakan partikel confetti — 10 arah merata. */
const BURST_ANGLES = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);

const BURST_COLORS = ['#0A45FE', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'];

/**
 * Success animation — checkmark scale-in + confetti ringan (10
 * partikel, sekali jalan, ≤300ms). Reduce Motion → ikon statis.
 */
export function SuccessBurst({
    children,
}: PropsWithChildren) {
    const reduced = useReducedMotion();

    if (reduced) {
        return <span className="relative inline-flex">{children}</span>;
    }

    return (
        <span className="relative inline-flex">
            <motion.span
                className="inline-flex"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            >
                {children}
            </motion.span>
            {BURST_ANGLES.map((angle, index) => (
                <motion.span
                    key={index}
                    className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                    style={{
                        backgroundColor:
                            BURST_COLORS[index % BURST_COLORS.length],
                    }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                        x: Math.cos(angle) * 34,
                        y: Math.sin(angle) * 34,
                        opacity: 0,
                        scale: 0.4,
                    }}
                    transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
                />
            ))}
        </span>
    );
}

export interface FlyToCartState {
    key: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
}

/**
 * Fly-to-cart — titik kecil terbang dari card produk ke keranjang
 * (murni transform + opacity, 300ms).
 */
export function FlyDot({
    fly,
    onDone,
}: {
    fly: FlyToCartState | null;
    onDone: () => void;
}) {
    return (
        <AnimatePresence>
            {fly && (
                <motion.span
                    key={fly.key}
                    className="pointer-events-none fixed left-0 top-0 z-[70] h-4 w-4 rounded-full bg-[#0A45FE] shadow"
                    initial={{ x: fly.from.x, y: fly.from.y, opacity: 0.9, scale: 1 }}
                    animate={{ x: fly.to.x, y: fly.to.y, opacity: 0.3, scale: 0.4 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeIn' }}
                    onAnimationComplete={onDone}
                />
            )}
        </AnimatePresence>
    );
}

/**
 * MotionButton (ripple) — satu listener terdelegasi untuk SEMUA
 * tombol (tanpa copy-paste per tombol). Tombol dengan atribut
 * `data-no-ripple` dilewati (mis. card produk yang punya badge di
 * luar bounds). Reduce Motion → tanpa ripple.
 */
export function RippleEffect() {
    useEffect(() => {
        const handler = (event: PointerEvent) => {
            if (
                window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ) {
                return;
            }

            const target = (event.target as HTMLElement | null)?.closest(
                'button',
            );

            if (
                !target ||
                target.disabled ||
                target.closest('[data-no-ripple]') !== null
            ) {
                return;
            }

            const rect = target.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 2;
            const ripple = document.createElement('span');

            ripple.className = 'ui-ripple';
            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

            const computed = window.getComputedStyle(target);
            if (computed.position === 'static') {
                target.style.position = 'relative';
            }
            if (computed.overflow !== 'hidden') {
                target.style.overflow = 'hidden';
            }

            target.appendChild(ripple);
            window.setTimeout(() => ripple.remove(), 320);
        };

        document.addEventListener('pointerdown', handler);

        return () => document.removeEventListener('pointerdown', handler);
    }, []);

    return null;
}
