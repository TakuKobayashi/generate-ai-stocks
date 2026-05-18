import type { Metadata } from 'next';
import RecordingApp from '@/components/RecordingApp';

export const metadata: Metadata = {
  title: 'RecStudio — Browser Screen Recorder',
};

export default function Page() {
  return <RecordingApp />;
}
