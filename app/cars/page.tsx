import { Metadata } from 'next';
import { Suspense } from 'react';
import PageShell from '../../components/PageShell';
import CarDatabase from '../../components/CarDatabase';

export const metadata: Metadata = {
    title: 'Car Database | Sunnylink Wiki',
    description: 'Find the best Sunnypilot settings for your specific vehicle based on community consensus and verified hardware requirements.',
};

export default function CarsPage() {
    return (
        <PageShell>
            <div>
                <Suspense fallback={<div className="h-screen bg-slate-950" />}>
                    <CarDatabase />
                </Suspense>
            </div>
        </PageShell>
    );
}
