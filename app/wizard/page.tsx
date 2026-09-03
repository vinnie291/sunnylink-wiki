import PageShell from '@/components/PageShell';
import ConfigWizard from '@/components/ConfigWizard';
import ExitWizardButton from '@/components/ExitWizardButton';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Config Wizard | Sunnylink',
    description: 'Build a complete sunnypilot configuration file with community-tested settings for your vehicle. Step-by-step guided config builder with JSON export.',
    keywords: ['sunnylink', 'sunnypilot config builder', 'sunnypilot configuration', 'sunnypilot setup wizard', 'sunnypilot json config', 'sunnypilot settings generator', 'sunnylink wizard'],
    openGraph: {
        title: 'Sunnylink Config Wizard',
        description: 'Build a ready-to-use sunnypilot config file in minutes with community-tested recommendations.',
    }
};

export default function WizardPage() {
    return (
        <PageShell showHeader={false}>
            <div className="max-w-4xl mx-auto">
                <ConfigWizard />
            </div>
        </PageShell>
    );
}
