// Google Analytics event tracking utility

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
        dataLayer?: unknown[];
    }
}

export const COMMA_REFERRAL_URL = 'https://refer.comma.ai/DQHAMJM';

export function trackEvent(action: string, params: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;
    const gtag = typeof window.gtag === 'function'
        ? window.gtag
        : (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === 'function') {
        gtag('event', action, params);
    }
}

export type ReferralSource = 'popup' | 'dashboard';

export function trackReferralClick(source: ReferralSource) {
    trackEvent('referral_click', {
        event_category: 'referral',
        event_label: 'comma_four',
        source,
        location: source,
        placement: source,
        link_url: COMMA_REFERRAL_URL,
    });
}
