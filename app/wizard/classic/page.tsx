import PageShell from '@/components/PageShell';
import SetupWizard from '@/components/SetupWizard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Classic Setup Wizard | Sunnylink',
    description: 'Interactive wizard to generate the perfect Sunnypilot configuration based on your car, driving style, and expertise.',
    keywords: ['sunnylink', 'sunnylink wizard', 'sunnypilot', 'sunnypilot setup wizard'],
    openGraph: {
        title: 'Sunnylink Classic Setup Wizard',
        description: 'Get a personalized Sunnypilot configuration in minutes.',
    }
};

export default function ClassicWizardPage() {
    return (
        <PageShell>
            <div className="max-w-4xl mx-auto">
                <SetupWizard />
            </div>
        </PageShell>
    );
}
