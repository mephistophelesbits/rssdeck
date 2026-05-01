'use client';

import { Coffee } from 'lucide-react';

const BMAC_URL = 'https://buymeacoffee.com/kianfongl';

type ElectronWindow = Window & { electronAPI?: { openExternal: (url: string) => void } };

export function AdCard() {
  const handleClick = () => {
    const electronAPI = (window as ElectronWindow).electronAPI;
    if (electronAPI) {
      electronAPI.openExternal(BMAC_URL);
    } else {
      window.open(BMAC_URL, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="border-b border-border px-3 py-3 bg-accent-light/40 hover:bg-accent-light/60 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Coffee className="w-4 h-4 text-accent flex-shrink-0" />
          <p className="text-sm text-foreground">
            Like IntelliDeck?{' '}
            <button
              type="button"
              onClick={handleClick}
              className="text-accent hover:underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            >
              Buy Fong a coffee.
            </button>
          </p>
        </div>
        <span className="text-[10px] text-foreground-secondary flex-shrink-0 mt-0.5">Support</span>
      </div>
    </div>
  );
}
