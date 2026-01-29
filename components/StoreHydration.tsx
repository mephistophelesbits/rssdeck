'use client';

import { useEffect, useState } from 'react';

interface StoreHydrationProps {
  children: React.ReactNode;
}

export function StoreHydration({ children }: StoreHydrationProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Wait for stores to rehydrate from localStorage
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    // Show loading state during SSR and initial hydration
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-foreground-secondary text-sm">Loading RSS Deck...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
