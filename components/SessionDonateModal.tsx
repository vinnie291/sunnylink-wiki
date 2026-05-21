'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Fires once a visitor has spent ~5 minutes on the site (across any
// number of page navigations within the same tab). Dismissal is sticky
// for 30 days so the same user doesn't keep getting nudged.
const LS_KEY = 'sunnylink:donate-modal-dismissed';
const TRIGGER_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const BMC_URL = 'https://buymeacoffee.com/vinhle.co';

const trackEvent = (action: string, params: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') return;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === 'function') {
        gtag('event', action, params);
    }
};

export default function SessionDonateModal() {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    // Schedule the prompt once on mount. Skips if a recent dismissal is
    // still inside the cooldown window.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(LS_KEY);
            if (raw) {
                const ts = Number(raw);
                if (!Number.isNaN(ts) && Date.now() - ts < COOLDOWN_MS) return;
            }
        } catch {
            // localStorage can throw in private modes — fall through and just show normally.
        }
        const handle = window.setTimeout(() => {
            setOpen(true);
            trackEvent('donate_modal_shown', { trigger_ms: TRIGGER_MS });
        }, TRIGGER_MS);
        return () => window.clearTimeout(handle);
    }, []);

    const dismiss = (method: 'backdrop' | 'escape' | 'no_thanks' | 'cta' = 'backdrop') => {
        try {
            window.localStorage.setItem(LS_KEY, String(Date.now()));
        } catch {
            // ignore
        }
        if (method !== 'cta') {
            trackEvent('donate_modal_dismissed', { method });
        }
        setOpen(false);
    };

    // Esc to close + body-scroll lock while open.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') dismiss('escape');
        };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!mounted || !open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => dismiss('backdrop')}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="donate-modal-title"
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200"
            >
                <div className="text-4xl text-center mb-3" aria-hidden>☕</div>
                <h2
                    id="donate-modal-title"
                    className="text-xl sm:text-2xl font-bold text-white text-center leading-snug mb-2"
                >
                    Has this site helped you setup your sunnypilot?
                </h2>
                <p className="text-sm text-slate-400 text-center mb-6">
                    If the wiki saved you some time, consider buying me a coffee — it keeps this thing alive.
                </p>

                <a
                    href={BMC_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                        trackEvent('donate_modal_clicked', { destination: BMC_URL });
                        dismiss('cta');
                    }}
                    className="block w-full text-center font-bold py-3 px-5 rounded-xl bg-[#FFDD00] hover:bg-[#ffe84d] active:bg-[#e6c700] text-slate-900 transition-colors shadow-md"
                >
                    ☕ Buy me a coffee
                </a>

                <button
                    type="button"
                    onClick={() => dismiss('no_thanks')}
                    className="block mx-auto mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                    No thanks
                </button>
            </div>
        </div>,
        document.body,
    );
}
