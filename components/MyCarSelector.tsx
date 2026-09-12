'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CarFront, Check, ChevronDown, X } from 'lucide-react';
import { COMMA_DEVICES, saveMyCar, supportedCars, useMyCar } from '../lib/myCar';
import type { CommaDevice } from '../lib/myCar';

const years = [...new Set(supportedCars.vehicles.flatMap(car =>
    Array.from({ length: car.endYear - car.startYear + 1 }, (_, i) => car.startYear + i)
))].sort((a, b) => b - a);

const TIP_STORAGE_KEY = 'sunnylink-my-car-tip-seen-v1';
const TIP_CHANGE_EVENT = 'sunnylink-my-car-tip-changed';
let memoryTipSeen = false;

function subscribeToTip(callback: () => void) {
    const onStorage = (event: StorageEvent) => {
        if (event.key === TIP_STORAGE_KEY || event.key === null) callback();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(TIP_CHANGE_EVENT, callback);
    return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(TIP_CHANGE_EVENT, callback);
    };
}

function getTipSeen() {
    try { return localStorage.getItem(TIP_STORAGE_KEY) === 'true'; }
    catch { return memoryTipSeen; }
}

export default function MyCarSelector({ stretch = false, showFirstVisitTip = true }: { stretch?: boolean; showFirstVisitTip?: boolean }) {
    const selection = useMyCar();
    const [open, setOpen] = useState(false);
    const [year, setYear] = useState('');
    const [make, setMake] = useState('');
    const [vehicleId, setVehicleId] = useState('');
    const [device, setDevice] = useState<CommaDevice | ''>('');
    const tipSeen = useSyncExternalStore(subscribeToTip, getTipSeen, () => true);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const id = useId();
    const carsForYear = supportedCars.vehicles.filter(car => Number(year) >= car.startYear && Number(year) <= car.endYear);
    const makes = [...new Set(carsForYear.map(car => car.make))].sort();
    const models = carsForYear.filter(car => car.make === make).sort((a, b) => a.model.localeCompare(b.model));
    const vehicle = models.find(car => car.id === vehicleId);
    const summary = selection ? `${selection.year} ${selection.vehicle.make} ${selection.vehicle.model}${selection.device ? `, ${selection.device}` : ''}` : 'My car';

    useEffect(() => {
        if (!open) return;
        const dialog = dialogRef.current;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog?.showModal();
        return () => {
            dialog?.close();
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);

    function dismissTip() {
        memoryTipSeen = true;
        try { localStorage.setItem(TIP_STORAGE_KEY, 'true'); }
        catch { /* The tooltip still dismisses for this page. */ }
        window.dispatchEvent(new Event(TIP_CHANGE_EVENT));
    }

    function showSelector() {
        dismissTip();
        setYear(selection ? String(selection.year) : '');
        setMake(selection?.vehicle.make ?? '');
        setVehicleId(selection?.vehicleId ?? '');
        setDevice(selection?.device ?? '');
        setOpen(true);
    }

    return <div className={`relative ${stretch ? 'w-full' : ''}`}>
        <button type="button" onClick={showSelector} aria-haspopup="dialog" aria-expanded={open}
            aria-label={selection ? `My car: ${summary}. Change car` : 'Select my car'} title={summary}
            className={`my-car-trigger flex items-center gap-2 h-10 sm:h-12 px-3 rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm hover:bg-slate-700/50 hover:border-cyan-500/50 text-slate-300 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${stretch ? 'w-full' : 'w-[136px] sm:w-52'}`}>
            <CarFront className="w-5 h-5 shrink-0 text-cyan-400" aria-hidden="true" />
            {selection ? (
                <span className="flex-1 min-w-0 text-left font-semibold leading-[1.05]">
                    <span className="block truncate text-[10px] sm:text-xs text-slate-300">{selection.year} {selection.vehicle.make}</span>
                    <span className="block truncate text-[10px] sm:text-xs text-slate-400 mt-0.5">{selection.vehicle.model}{selection.device ? ` · ${selection.device.replace('comma ', 'C')}` : ''}</span>
                </span>
            ) : (
                <span className="truncate text-xs sm:text-sm font-semibold flex-1 text-left">My car</span>
            )}
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
        {showFirstVisitTip && !tipSeen && !selection && (
            <div role="status" className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-cyan-500/30 bg-slate-900 p-3 pr-9 text-left shadow-xl shadow-slate-950/40">
                <span className="absolute -top-1.5 left-5 h-3 w-3 rotate-45 border-l border-t border-cyan-500/30 bg-slate-900" aria-hidden="true" />
                <p className="text-xs font-bold text-cyan-300">Set up My car</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">Choose your vehicle and comma device once. We’ll remember them on this browser.</p>
                <button type="button" onClick={dismissTip} aria-label="Dismiss My car tip" className="absolute right-2 top-2 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><X className="h-3.5 w-3.5" /></button>
            </div>
        )}
        {open && createPortal(
            <dialog ref={dialogRef} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
                className="my-car-dialog border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
                onCancel={() => setOpen(false)} onClose={() => setOpen(false)}
                onClick={event => { if (event.target === event.currentTarget) {
                    const bounds = event.currentTarget.getBoundingClientRect();
                    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false);
                } }}>
                <form className="p-5 sm:p-6" onSubmit={event => {
                    event.preventDefault();
                    if (!vehicle || !device) return;
                    saveMyCar({ year: Number(year), vehicleId: vehicle.id, device });
                    setOpen(false);
                }}>
                    <div className="flex items-start justify-between gap-4 mb-5">
                        <div className="flex gap-3 items-center">
                            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400"><CarFront className="w-6 h-6" aria-hidden="true" /></div>
                            <div><h2 id={`${id}-title`} className="font-bold text-xl">My car</h2>
                                <p id={`${id}-description`} className="text-xs text-slate-400 mt-1">Choose your vehicle and comma device. Saved on this browser.</p></div>
                        </div>
                        <button type="button" onClick={() => setOpen(false)} aria-label="Close car selector" className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 focus-visible:outline-cyan-400"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
                        <label className="text-sm font-medium text-slate-300" htmlFor={`${id}-year`}>Year
                            <select id={`${id}-year`} required value={year} onChange={event => { setYear(event.target.value); setMake(''); setVehicleId(''); }} className="my-car-select mt-2">
                                <option value="">Select year</option>{years.map(value => <option key={value} value={value}>{value}</option>)}
                            </select>
                        </label>
                        <label className="text-sm font-medium text-slate-300" htmlFor={`${id}-make`}>Manufacturer
                            <select id={`${id}-make`} required disabled={!year} value={make} onChange={event => { setMake(event.target.value); setVehicleId(''); }} className="my-car-select mt-2">
                                <option value="">{year ? 'Select make' : 'Choose year first'}</option>{makes.map(value => <option key={value} value={value}>{value}</option>)}
                            </select>
                        </label>
                        <label className="col-span-2 text-sm font-medium text-slate-300" htmlFor={`${id}-model`}>Model
                            <select id={`${id}-model`} required disabled={!make} value={vehicleId} onChange={event => setVehicleId(event.target.value)} className="my-car-select mt-2">
                                <option value="">{make ? 'Select model' : 'Choose manufacturer first'}</option>
                                {models.map(car => <option key={car.id} value={car.id}>{car.model}{models.filter(other => other.model === car.model).length > 1 ? ` — ${car.requiredPackage}` : ''}</option>)}
                            </select>
                        </label>
                        <label className="col-span-2 text-sm font-medium text-slate-300" htmlFor={`${id}-device`}>Comma device
                            <select id={`${id}-device`} required value={device} onChange={event => setDevice(event.target.value as CommaDevice | '')} className="my-car-select mt-2">
                                <option value="">Select device</option>
                                {COMMA_DEVICES.map(value => <option key={value} value={value}>{value}</option>)}
                            </select>
                        </label>
                    </div>
                    {vehicle && <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm" aria-live="polite">
                        <p className="font-semibold text-slate-100">{year} {vehicle.make} {vehicle.model}</p>
                        <p className="text-slate-400 mt-1">Supported package: <span className="text-slate-300">{vehicle.requiredPackage}</span></p>
                    </div>}
                    <p className="mt-4 text-xs leading-relaxed text-slate-400">From the <a href={supportedCars.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline underline-offset-2">official openpilot supported-car list</a>. US market unless noted; package requirements and footnotes apply.</p>
                    <div className="flex items-center gap-3 mt-5">
                        {selection && <button type="button" className="text-sm text-slate-400 hover:text-slate-100 px-2 py-3" onClick={() => { saveMyCar(null); setOpen(false); }}>Clear car</button>}
                        <button type="submit" disabled={!vehicle || !device} className="ml-auto flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><Check className="w-4 h-4" aria-hidden="true" />Save car</button>
                    </div>
                </form>
            </dialog>, document.body
        )}
    </div>;
}
