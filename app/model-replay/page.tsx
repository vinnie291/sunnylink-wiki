import type { Metadata } from 'next';
import ModelReplayClient from './ModelReplayClient';

// Experimental comparison tool, not wiki reference content — kept out of
// search results and sitemaps.
export const metadata: Metadata = {
    title: 'Synthetic vs. Real Model Vision | Sunnylink',
    description: 'Compare the heuristic drive simulator against a real recorded openpilot model replay.',
    robots: { index: false, follow: false },
};

export default function ModelReplayPage() {
    return <ModelReplayClient />;
}
