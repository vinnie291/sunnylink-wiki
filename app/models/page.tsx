import PageShell from '@/components/PageShell';
import ModelLibrary from '@/components/ModelLibrary';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Model Library | Sunnylink',
    description: 'Explore the complete library of over 66 Driving Models for Sunnypilot. Compare features, consensus, and release dates.',
    keywords: ['sunnylink', 'sunnylink models', 'sunnypilot', 'sunnypilot driving models', 'sunnypilot wiki', 'sunnypilot features', 'sunnylink app', 'sunnypilot settings', 'sunnypilot sunnylink', 'sunnylink sunnypilot latest version', 'model library', 'openpilot models'],
    openGraph: {
        title: 'Sunnylink Model Library',
        description: 'Explore over 66+ Driving Models. Find the perfect match for your driving style.',
    }
};

export default function ModelsPage() {
    return (
        <PageShell>
            <div>
                <ModelLibrary />
            </div>
        </PageShell>
    );
}
