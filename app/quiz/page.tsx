import PageShell from '@/components/PageShell';
import ModelQuiz from '@/components/ModelQuiz';
import type { Metadata } from 'next';

const SITE_URL = 'https://sunnylink.wiki';
const PAGE_URL = `${SITE_URL}/quiz`;

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: 'Model Finder Quiz — Find Your Ideal openpilot Driving Model | Sunnylink Wiki',
    description: 'Answer 3 quick questions to discover the best openpilot/Sunnypilot driving model for your car and driving style. Calibrated across 136+ community-rated models.',
    keywords: ['sunnylink', 'sunnypilot model finder', 'sunnypilot quiz', 'sunnypilot best model', 'sunnypilot driving model recommendation', 'which sunnypilot model', 'sunnypilot model quiz', 'openpilot model quiz'],
    alternates: {
        canonical: PAGE_URL,
    },
    openGraph: {
        title: 'Find Your Perfect openpilot Driving Model | Sunnylink Wiki',
        description: 'Answer 3 quick questions. Get personalized model recommendations backed by community data from 136+ driving models.',
        url: PAGE_URL,
        siteName: 'Sunnylink Wiki',
        type: 'website',
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'openpilot Driving Model Quiz | Sunnylink Wiki',
        description: 'Find your best driving model recommendation in 3 questions.',
    },
};

export default function QuizPage() {
    return (
        <PageShell pageHasOwnHeading>
            <div className="max-w-4xl mx-auto">
                <ModelQuiz />
            </div>
        </PageShell>
    );
}
