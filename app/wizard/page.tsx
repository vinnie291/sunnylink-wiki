import PageShell from '@/components/PageShell';
import SetupWizard from '@/components/SetupWizard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Setup Wizard | Sunnylink',
    description: 'Interactive wizard to generate the perfect Sunnypilot configuration based on your car, driving style, and expertise.',
    keywords: ['sunnylink', 'sunnylink wizard', 'sunnypilot', 'sunnypilot setup wizard', 'sunnypilot wiki', 'sunnypilot features', 'sunnylink app', 'sunnypilot settings', 'sunnypilot sunnylink', 'sunnylink sunnypilot latest version', 'configuration', 'settings generator'],
    openGraph: {
        title: 'Sunnylink Setup Wizard',
        description: 'Get a personalized Sunnypilot configuration in minutes.',
    }
};

export default function WizardPage() {
    return (
        <PageShell>
            <div className="max-w-4xl mx-auto">
                <SetupWizard />
            </div>
        </PageShell>
    );
}
