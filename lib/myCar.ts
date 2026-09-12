'use client';

import { useMemo, useSyncExternalStore } from 'react';
import catalogue from '../data/supported-cars.json';

export const supportedCars = catalogue;
export const COMMA_DEVICES = ['comma 3', 'comma 3X', 'comma 4'] as const;
export type CommaDevice = typeof COMMA_DEVICES[number];
export type MyCar = { year: number; vehicleId: string; device?: CommaDevice };
export const MY_CAR_STORAGE_KEY = 'sunnylink-my-car-v1';
const CHANGE_EVENT = 'sunnylink-my-car-changed';
let memorySelection: string | null = null;

function subscribe(callback: () => void) {
    const onStorage = (event: StorageEvent) => {
        if (event.key === MY_CAR_STORAGE_KEY || event.key === null) callback();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, callback);
    return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(CHANGE_EVENT, callback);
    };
}

function getSnapshot() {
    try { return window.localStorage.getItem(MY_CAR_STORAGE_KEY); }
    catch { return memorySelection; }
}

export function saveMyCar(selection: MyCar | null) {
    memorySelection = selection ? JSON.stringify(selection) : null;
    try {
        if (memorySelection) window.localStorage.setItem(MY_CAR_STORAGE_KEY, memorySelection);
        else window.localStorage.removeItem(MY_CAR_STORAGE_KEY);
    } catch { /* Keep the selection in memory when storage is unavailable. */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useMyCar() {
    const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
    return useMemo(() => {
        if (!raw) return null;
        try {
            const selection = JSON.parse(raw) as MyCar;
            const vehicle = catalogue.vehicles.find(car => car.id === selection?.vehicleId);
            if (!vehicle || !Number.isInteger(selection.year) || selection.year < vehicle.startYear || selection.year > vehicle.endYear) return null;
            const device = COMMA_DEVICES.includes(selection.device as CommaDevice) ? selection.device : undefined;
            return { year: selection.year, vehicleId: selection.vehicleId, device, vehicle };
        } catch { return null; }
    }, [raw]);
}
