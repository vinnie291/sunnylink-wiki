import type { Metadata } from 'next';
import StatsClient from './StatsClient';

export const metadata: Metadata = {
    title: 'Live Stats | Sunnylink',
    description: 'Live fleet statistics for the Sunnypilot community. Track active users, models, and more.',
    keywords: ['sunnylink', 'sunnylink stats', 'sunnypilot', 'sunnypilot stats', 'sunnypilot wiki', 'sunnypilot features', 'sunnylink app', 'sunnypilot settings', 'sunnypilot sunnylink', 'sunnylink sunnypilot latest version', 'fleet statistics', 'live stats'],
    openGraph: {
        title: 'Sunnylink Live Stats',
        description: 'Real-time fleet statistics for Sunnypilot.',
    }
};

export default function StatsPage() {
    return <StatsClient />;
}
