import type { Metadata } from 'next';
import StatsClient from './StatsClient';
import { getPublicFleetCharts } from '@/lib/metabase';

export const revalidate = 300;

const SITE_URL = 'https://www.sunnylink.wiki';
const PAGE_URL = `${SITE_URL}/stats`;

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: 'Sunnypilot Community Fleet Telemetry & Live Stats | Sunnylink Wiki',
    description: 'Live fleet telemetry and usage statistics for the global Sunnypilot community. Track active driving models, devices, miles driven, and model adoption trends.',
    keywords: ['sunnylink', 'sunnylink stats', 'sunnypilot', 'sunnypilot stats', 'sunnypilot wiki', 'sunnypilot features', 'sunnylink app', 'sunnypilot settings', 'sunnypilot sunnylink', 'sunnylink sunnypilot latest version', 'fleet statistics', 'live stats'],
    alternates: {
        canonical: PAGE_URL,
    },
    openGraph: {
        title: 'Sunnypilot Fleet Telemetry & Live Stats | Sunnylink Wiki',
        description: 'Real-time fleet statistics and openpilot driving model adoption metrics.',
        url: PAGE_URL,
        siteName: 'Sunnylink Wiki',
        type: 'website',
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Sunnypilot Community Fleet Telemetry & Live Stats',
        description: 'Real-time fleet statistics and driving model telemetry from the Sunnypilot community.',
    },
};

export default async function StatsPage() {
    return <StatsClient charts={await getPublicFleetCharts()} />;
}
