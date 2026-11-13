import PageShell from '@/components/PageShell';
import ConfigWizard from '@/components/ConfigWizard';
import type { Metadata } from 'next';

const SITE_URL = 'https://sunnylink.wiki';
const PAGE_URL = `${SITE_URL}/wizard`;

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: 'Sunnypilot Config Wizard — Step-by-Step Vehicle Configuration Builder | Sunnylink Wiki',
    description: 'Build a complete, device-ready Sunnypilot configuration file with community-tested settings for your vehicle. Step-by-step guided config generator with direct JSON export.',
    keywords: ['sunnylink', 'sunnypilot config builder', 'sunnypilot configuration', 'sunnypilot setup wizard', 'sunnypilot json config', 'sunnypilot settings generator', 'sunnylink wizard'],
    alternates: {
        canonical: PAGE_URL,
    },
    openGraph: {
        title: 'Sunnypilot Config Wizard | Sunnylink Wiki',
        description: 'Build a ready-to-use Sunnypilot configuration in minutes with community-tested recommendations for your specific car.',
        url: PAGE_URL,
        siteName: 'Sunnylink Wiki',
        type: 'website',
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Sunnypilot Config Wizard | Sunnylink Wiki',
        description: 'Guided vehicle configuration builder with direct JSON export for Sunnypilot.',
    },
};

export default function WizardPage() {
    return (
        <PageShell showHeader={false} pageHasOwnHeading>
            <div className="max-w-4xl mx-auto">
                <ConfigWizard />
            </div>
        </PageShell>
    );
}
