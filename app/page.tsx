'use client';

import LandingPage from '@/components/LandingPage';
import { Dashboard } from '@/components/Dashboard';

export default function Home() {
  const isLandingMode = process.env.NEXT_PUBLIC_APP_MODE === 'landing';

  return isLandingMode ? <LandingPage /> : <Dashboard />;
}
