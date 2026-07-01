'use client';

import { useCallback, useRef, useState } from 'react';
import { parseLogFile, ParsedLog } from '../lib/openpilotLog/parseLogFile';

type Status = 'idle' | 'reading' | 'ready' | 'error';

interface Props {
    onLoaded: (log: ParsedLog, fileName: string) => void;
}

export default function OnroadLogSourcePanel({ onLoaded }: Props) {
    const [status, setStatus] = useState<Status>('idle');
    const [fileName, setFileName] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [summary, setSummary] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (file: File) => {
        setStatus('reading');
        setError('');
        setFileName(file.name);
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const log = parseLogFile(bytes);
            if (log.modelV2.length === 0) {
                setStatus('error');
                setError('No modelV2 messages found in this file — is it a real rlog/qlog?');
                return;
            }
            setSummary(`${log.modelV2.length} modelV2 · ${log.liveCalibration.length} liveCalibration samples`);
            setStatus('ready');
            onLoaded(log, file.name);
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to parse log file');
        }
    }, [onLoaded]);

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) void handleFile(file);
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) void handleFile(file);
    };

    return (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-200">Real model log</h3>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">rlog / qlog (.zst)</span>
            </div>

            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className="cursor-pointer rounded-lg border-2 border-dashed border-slate-700/60 hover:border-cyan-500/50 transition-colors px-4 py-6 text-center"
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".zst,.bz2,application/octet-stream"
                    className="hidden"
                    onChange={onInputChange}
                />
                {status === 'idle' && (
                    <p className="text-xs text-slate-400">
                        Drop a real openpilot rlog/qlog here, or click to choose a file
                    </p>
                )}
                {status === 'reading' && <p className="text-xs text-cyan-300">Parsing {fileName}…</p>}
                {status === 'ready' && (
                    <div>
                        <p className="text-xs text-emerald-400 font-medium">{fileName}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{summary}</p>
                    </div>
                )}
                {status === 'error' && (
                    <div>
                        <p className="text-xs text-red-400 font-medium">{fileName}</p>
                        <p className="text-[11px] text-red-400/80 mt-1">{error}</p>
                    </div>
                )}
            </div>

            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                Only zstd-compressed logs are supported today (modern openpilot). This file
                is parsed entirely in your browser — nothing is uploaded anywhere.
            </p>
        </div>
    );
}
