'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/lib/i18n';
import type { PublicFleetChart } from '@/lib/metabase';

export default function PublicFleetDashboard({ charts }: { charts: PublicFleetChart[] }) {
    const { tx, locale } = useLanguage();
    const number = new Intl.NumberFormat(locale);
    const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    return <div className="grid gap-6 lg:grid-cols-2">
        {charts.map(chart => <section key={chart.id} className="min-w-0 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5">
            <h3 className="mb-4 text-lg font-semibold text-slate-100">{tx(chart.title)}</h3>
            {chart.id === 39 ? <div className="h-72" role="img" aria-label={tx(chart.title)}>
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 288 }}>
                    <LineChart data={chart.rows.map(row => ({ timestamp: String(row[0]), users: Number(row[1]) }))}>
                        <XAxis dataKey="timestamp" tickFormatter={value => date.format(new Date(value))} minTickGap={60} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={value => number.format(value)} tick={{ fontSize: 11 }} width={55} />
                        <Tooltip labelFormatter={value => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(String(value)))} formatter={value => [number.format(Number(value)), tx('Users')]} />
                        <Line dataKey="users" name={tx('Users')} stroke="#06b6d4" dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div> : <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-900 text-slate-400"><tr>{chart.columns.map(column => <th key={column} scope="col" className="p-2">{tx(column)}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-700/40 text-slate-300">{chart.rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column} className="p-2">
                        {chart.id === 46 && column === 0 ? tx(value ? 'Enabled' : 'Disabled') : typeof value === 'number' ? number.format(value) : value === null || value === '' ? tx('Unknown') : String(value)}
                    </td>)}</tr>)}</tbody>
                </table>
            </div>}
        </section>)}
    </div>;
}
