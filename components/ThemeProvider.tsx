'use client';

import { useEffect } from 'react';
import { useSettingsStore, getThemeById } from '@/lib/settings-store';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themeId = useSettingsStore((state) => state.themeId);

  useEffect(() => {
    const theme = getThemeById(themeId);
    const root = document.documentElement;

    root.style.setProperty('--background', theme.background);
    root.style.setProperty('--background-secondary', theme.backgroundSecondary);
    root.style.setProperty('--background-tertiary', theme.backgroundTertiary);
    root.style.setProperty('--foreground', theme.foreground);
    root.style.setProperty('--foreground-secondary', theme.foregroundSecondary);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent-hover', theme.accentHover);
    root.style.setProperty('--border', theme.border);
    root.setAttribute('data-theme', themeId);
  }, [themeId]);

  return <>{children}</>;
}
