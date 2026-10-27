'use client';
import TranslatedText from '@/components/TranslatedText';
import { useLanguage } from '@/lib/i18n';


import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend
} from 'recharts';

interface ChartData {
    name: string;
    value: number;
}

interface StatsChartsProps {
    branchDistribution: ChartData[];
    topModels: ChartData[];
}

// Theme-aware colors matching the app's design
const CHART_COLORS = [
    '#06b6d4', // cyan-500
    '#8b5cf6', // violet-500
    '#f59e0b', // amber-500
    '#10b981', // emerald-500
    '#f43f5e', // rose-500
    '#3b82f6', // blue-500
    '#ec4899', // pink-500
    '#14b8a6', // teal-500
];

export function BranchDistributionChart({ data }: { data: ChartData[] }) {
    const { tx, locale } = useLanguage();
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500">
                 <TranslatedText text={"No branch distribution data available"} /> </div>
        );
    }

    return (
        <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                        labelLine={{ stroke: '#64748b', strokeWidth: 1 }}
                    >
                        {data.map((_, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                                stroke="transparent"
                            />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'var(--color-slate-800)',
                            border: '1px solid var(--color-slate-600)',
                            borderRadius: '0.75rem',
                            color: 'white'
                        }}
                        formatter={(value) => [Number(value ?? 0).toLocaleString(locale), tx('Devices')]}
                    />
                    <Legend
                        content={<ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-slate-400">
                            {data.map((item, index) => <li key={item.name} className="flex items-center gap-2">
                                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                {item.name}
                            </li>)}
                        </ul>}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

export function TopModelsChart({ data }: { data: ChartData[] }) {
    const { tx, locale } = useLanguage();
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500">
                 <TranslatedText text={"No model data available"} /> </div>
        );
    }

    return (
        <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                    <XAxis
                        type="number"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        axisLine={{ stroke: '#475569' }}
                        tickLine={{ stroke: '#475569' }}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        axisLine={{ stroke: '#475569' }}
                        tickLine={{ stroke: '#475569' }}
                        width={75}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'var(--color-slate-800)',
                            border: '1px solid var(--color-slate-600)',
                            borderRadius: '0.75rem',
                            color: 'white'
                        }}
                        formatter={(value) => [Number(value ?? 0).toLocaleString(locale), tx('Routes')]}
                        cursor={{ fill: 'rgba(6, 182, 212, 0.1)' }}
                    />
                    <Bar
                        dataKey="value"
                        fill="#06b6d4"
                        radius={[0, 4, 4, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export default function StatsCharts({ branchDistribution, topModels }: StatsChartsProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Branch Distribution */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <span>🌿</span>
                     <TranslatedText text={"Branch Distribution"} /> </h3>
                <BranchDistributionChart data={branchDistribution} />
            </div>

            {/* Top Models */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <span>🧠</span>
                     <TranslatedText text={"Top Models"} /> </h3>
                <TopModelsChart data={topModels} />
            </div>
        </div>
    );
}
