import { Metadata } from 'next';
import PageShell from '../../components/PageShell';
import CarDatabase from '../../components/CarDatabase';

export const metadata: Metadata = {
    title: 'Car Database | Sunnylink Wiki',
    description: 'Find the best Sunnypilot settings for your specific vehicle based on community consensus and verified hardware requirements.',
};

export default function CarsPage() {
    return (
        <PageShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <CarDatabase />
            </div>
        </PageShell>
    );
}
