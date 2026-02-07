import { Activity, Gauge, Users } from 'lucide-react';

interface KPICardProps {
    title: string;
    value: string | number;
    icon: 'users' | 'distance' | 'online';
    subtitle?: string;
}

const iconMap = {
    users: Users,
    distance: Gauge,
    online: Activity,
};

const colorMap = {
    users: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    distance: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
    online: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
};

export default function KPICard({ title, value, icon, subtitle }: KPICardProps) {
    const Icon = iconMap[icon];
    const colorClass = colorMap[icon];

    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 hover:bg-slate-800/70 transition-all duration-300">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
                    <p className="text-3xl font-bold text-white">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                    {subtitle && (
                        <p className="text-slate-500 text-xs mt-1">{subtitle}</p>
                    )}
                </div>
                <div className={`p-3 rounded-xl border ${colorClass}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    );
}
