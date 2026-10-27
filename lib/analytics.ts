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

export interface TrackCarParams {
    year: number;
    make: string;
    model: string;
    vehicleId: string;
    device?: string;
    package?: string;
}

export function trackCarSet(car: TrackCarParams) {
    const carName = `${car.year} ${car.make} ${car.model}`;
    trackEvent('set_my_car', {
        event_category: 'car_selector',
        event_label: carName,
        car_year: car.year,
        car_make: car.make,
        car_model: car.model,
        car_name: carName,
        vehicle_id: car.vehicleId,
        comma_device: car.device,
        required_package: car.package,
    });
}

export function trackCarCleared(previousCar?: {
    year?: number;
    make?: string;
    model?: string;
}) {
    const label = previousCar?.make
        ? `${previousCar.year ?? ''} ${previousCar.make} ${previousCar.model ?? ''}`.trim()
        : undefined;

    trackEvent('clear_my_car', {
        event_category: 'car_selector',
        ...(label ? { event_label: label } : {}),
        ...(previousCar?.make ? { car_make: previousCar.make } : {}),
        ...(previousCar?.model ? { car_model: previousCar.model } : {}),
        ...(previousCar?.year ? { car_year: previousCar.year } : {}),
    });
}

export function trackCarSelectorOpened(hasCar: boolean) {
    trackEvent('open_car_selector', {
        event_category: 'car_selector',
        has_existing_car: hasCar,
    });
}
