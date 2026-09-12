import type { Metadata } from 'next';
import SimulatorLab from '@/components/new-sim/SimulatorLab';

export const metadata: Metadata = {
  title: 'Driving Lab | Sunnylink Wiki',
  description: 'An experimental 3D road simulator with responsive traffic, curved roads, signals, and stop signs.',
  robots: { index: false, follow: false },
};

export default function NewSimPage() {
  return <SimulatorLab />;
}
