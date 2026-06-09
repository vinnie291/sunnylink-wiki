import PageShell from '@/components/PageShell';
import ModelQuiz from '@/components/ModelQuiz';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Model Finder Quiz | Sunnylink',
    description: 'Answer 3 quick questions to find the perfect Sunnypilot driving model for your car and driving style. Powered by community data from 80+ models.',
    keywords: ['sunnylink', 'sunnypilot model finder', 'sunnypilot quiz', 'sunnypilot best model', 'sunnypilot driving model recommendation', 'which sunnypilot model', 'sunnypilot model quiz'],
    openGraph: {
        title: 'Find Your Perfect Driving Model',
        description: 'Answer 3 questions. Get your top 3 model recommendations backed by community data.',
    }
};

export default function QuizPage() {
    return (
        <PageShell>
            <div className="max-w-4xl mx-auto">
                <ModelQuiz />
            </div>
        </PageShell>
    );
}
