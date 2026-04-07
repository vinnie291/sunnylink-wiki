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
            <div>
                <CarDatabase />
            </div>
        </PageShell>
    );
}
