import { Metadata } from 'next';
import { Suspense } from 'react';
import PageShell from '../../components/PageShell';
import CarDatabase from '../../components/CarDatabase';
import carsData from '@/data/cars.json';

const SITE_URL = 'https://sunnylink.wiki';
const PAGE_URL = `${SITE_URL}/cars`;
const vehiclesList = (carsData as { vehicles?: Array<{ id: string; make: string; model: string; years?: string; harness?: string }> }).vehicles ?? [];
const VEHICLE_COUNT = vehiclesList.length;

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: `Sunnypilot Supported Cars & Compatibility Database (${VEHICLE_COUNT}+ Vehicles) | Sunnylink Wiki`,
    description: `Check compatibility and recommended settings for ${VEHICLE_COUNT}+ cars supported by Sunnypilot and openpilot. View required harnesses, comma 3X/comma 4 support, radar compatibility, and tuning presets.`,
    keywords: [
        'sunnypilot cars',
        'sunnypilot supported cars',
        'openpilot supported cars',
        'comma 3x car compatibility',
        'comma 4 supported cars',
        'sunnypilot car list',
        'openpilot harness',
        'sunnypilot toyota',
        'sunnypilot hyundai',
        'sunnypilot honda',
        'sunnylink cars',
    ],
    alternates: {
        canonical: PAGE_URL,
    },
    openGraph: {
        title: `Sunnypilot Supported Cars Database (${VEHICLE_COUNT}+ Vehicles)`,
        description: `Find the best Sunnypilot settings, harnesses, and verified hardware requirements for ${VEHICLE_COUNT}+ vehicles.`,
        url: PAGE_URL,
        siteName: 'Sunnylink Wiki',
        type: 'website',
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
        title: `Sunnypilot Supported Cars & Compatibility Database`,
        description: `Verified hardware requirements, harnesses, and recommended settings for ${VEHICLE_COUNT}+ vehicles.`,
    },
};

const carsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${PAGE_URL}#cars-list`,
    name: 'Sunnypilot Compatible Vehicles',
    description: `Directory of ${VEHICLE_COUNT}+ vehicles compatible with Sunnypilot and openpilot with hardware requirements.`,
    numberOfItems: VEHICLE_COUNT,
    itemListElement: vehiclesList.slice(0, 100).map((car, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: `${car.make} ${car.model} (${car.years ?? 'All years'})`,
        description: `Required harness: ${car.harness ?? 'Standard harness'}`,
        url: `${PAGE_URL}?make=${encodeURIComponent(car.make)}&model=${encodeURIComponent(car.model)}`,
    })),
};

export default function CarsPage() {
    return (
        <PageShell pageHasOwnHeading>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(carsJsonLd) }}
            />
            <div>
                <header className="mb-8">
                    <h1 id="cars-database-heading" className="text-2xl md:text-3xl font-bold text-slate-100 mb-2 leading-tight">
                        Sunnypilot Supported Cars &amp; Compatibility Database
                    </h1>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Explore hardware compatibility, required wiring harnesses, and community-verified configuration presets for {VEHICLE_COUNT}+ vehicles supported by Sunnypilot across Toyota, Hyundai, Honda, Subaru, GM, Volkswagen, and more.
                    </p>
                </header>
                <Suspense fallback={<div className="h-screen bg-slate-950" />}>
                    <CarDatabase />
                </Suspense>
            </div>
        </PageShell>
    );
}
