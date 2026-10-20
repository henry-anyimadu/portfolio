'use client';

import dynamic from 'next/dynamic';

// The station touches WebGL, workers and input devices, so it renders on the client only.
const TeleopPage = dynamic(() => import('./teleop-page'), {
  ssr: false,
  loading: () => <main className="min-h-svh bg-ink" />,
});

export function TeleopClient() {
  return <TeleopPage />;
}
