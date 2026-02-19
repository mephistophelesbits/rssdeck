import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ThemeColors {
  id: string;
  name: string;
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  foreground: string;
  foregroundSecondary: string;
  accent: string;
  accentHover: string;
  border: string;
  isDark: boolean;
  fontFamily?: string;
}

export const themes: ThemeColors[] = [
  {
    id: 'organic',
    name: 'Modern Organic',
    background: '#f4f1ea',
    backgroundSecondary: '#e9e5dc',
    backgroundTertiary: '#ffffff',
    foreground: '#1c1917',
    foregroundSecondary: '#57534e',
    accent: '#44403c', // Warm charcoal/brownish
    accentHover: '#292524',
    border: '#d6d3cd',
    isDark: false,
    fontFamily: 'var(--font-dm-sans), sans-serif',
  },
  {
    id: 'dark-blue',
    name: 'Dark Blue (Default)',
    background: '#15202b',
    backgroundSecondary: '#192734',
    backgroundTertiary: '#22303c',
    foreground: '#ffffff',
    foregroundSecondary: '#8899a6',
    accent: '#1d9bf0',
    accentHover: '#1a8cd8',
    border: '#38444d',
    isDark: true,
    fontFamily: 'var(--font-dm-sans), sans-serif',
  },
  {
    id: 'ebook',
    name: 'Ebook Reader (Sepia)',
    background: '#f5f1e8',
    backgroundSecondary: '#e8e4d9',
    backgroundTertiary: '#dcd8cc',
    foreground: '#2f2f2f',
    foregroundSecondary: '#5f5f5f',
    accent: '#2c5f85',
    accentHover: '#4a86b0',
    border: '#cec9be',
    isDark: false,
    fontFamily: 'var(--font-playfair), serif',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk 2077',
    background: '#000000',
    backgroundSecondary: '#121212',
    backgroundTertiary: '#2a2a2a',
    foreground: '#f0f0f0',
    foregroundSecondary: '#9a9a9a',
    accent: '#fcee0a',
    accentHover: '#00f0ff',
    border: '#333333',
    isDark: true,
    fontFamily: 'var(--font-fira-code), monospace',
  },
  {
    id: 'cute',
    name: 'Pastel Dream',
    background: '#fff9fa',
    backgroundSecondary: '#ffeef2',
    backgroundTertiary: '#ffd1dc',
    foreground: '#5e5e5e',
    foregroundSecondary: '#888888',
    accent: '#ff80ab',
    accentHover: '#8c9eff',
    border: '#ffc0cb',
    isDark: false,
    fontFamily: 'var(--font-dm-sans), sans-serif',
  },
  {
    id: 'hacker',
    name: 'The Matrix',
    background: '#000000',
    backgroundSecondary: '#051405',
    backgroundTertiary: '#0a290a',
    foreground: '#00ff41',
    foregroundSecondary: '#008f11',
    accent: '#ccffcc',
    accentHover: '#ffffff',
    border: '#003b05',
    isDark: true,
    fontFamily: 'var(--font-fira-code), monospace',
  },
  {
    id: 'ironman',
    name: 'IRONMAN (J.A.R.V.I.S.)',
    background: '#020b14',
    backgroundSecondary: '#051a2b',
    backgroundTertiary: '#0a2a43',
    foreground: '#00d2ff',
    foregroundSecondary: '#0096c7',
    accent: '#ffb800',
    accentHover: '#ffd600',
    border: '#00d2ff44',
    isDark: true,
    fontFamily: 'var(--font-orbitron), sans-serif',
  },
  {
    id: 'ironman-hud',
    name: 'IRONMAN HUD (Mark VII)',
    background: '#0a0a0a',
    backgroundSecondary: '#121212',
    backgroundTertiary: '#1a1a1a',
    foreground: '#ffffff',
    foregroundSecondary: '#a0a0a0',
    accent: '#ff3d00',
    accentHover: '#ff6e40',
    border: '#ff3d0044',
    isDark: true,
    fontFamily: 'var(--font-orbitron), sans-serif',
  },
  {
    id: 'nord',
    name: 'Nord (Arctic)',
    background: '#2e3440',
    backgroundSecondary: '#3b4252',
    backgroundTertiary: '#434c5e',
    foreground: '#d8dee9',
    foregroundSecondary: '#88c0d0',
    accent: '#88c0d0',
    accentHover: '#81a1c1',
    border: '#4c566a',
    isDark: true,
    fontFamily: 'var(--font-inter), sans-serif',
  },
  {
    id: 'dracula',
    name: 'Dracula',
    background: '#282a36',
    backgroundSecondary: '#44475a',
    backgroundTertiary: '#6272a4',
    foreground: '#f8f8f2',
    foregroundSecondary: '#bd93f9',
    accent: '#ff79c6',
    accentHover: '#ff92d0',
    border: '#6272a4',
    isDark: true,
    fontFamily: 'var(--font-fira-code), monospace',
  },
  {
    id: 'midnight',
    name: 'Midnight Pro',
    background: '#0f172a',
    backgroundSecondary: '#1e293b',
    backgroundTertiary: '#334155',
    foreground: '#f8fafc',
    foregroundSecondary: '#94a3b8',
    accent: '#38bdf8',
    accentHover: '#0ea5e9',
    border: '#334155',
    isDark: true,
    fontFamily: 'var(--font-inter), sans-serif',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    background: '#1c1917',
    backgroundSecondary: '#292524',
    backgroundTertiary: '#44403c',
    foreground: '#fafaf9',
    foregroundSecondary: '#a8a29e',
    accent: '#fb923c',
    accentHover: '#f97316',
    border: '#44403c',
    isDark: true,
    fontFamily: 'var(--font-dm-sans), sans-serif',
  },
  {
    id: 'terminal',
    name: 'Retro Terminal',
    background: '#1a1a1a',
    backgroundSecondary: '#2b2b2b',
    backgroundTertiary: '#000000',
    foreground: '#ffb000',
    foregroundSecondary: '#cc8800',
    accent: '#ffcc00',
    accentHover: '#ffe680',
    border: '#ffb00044',
    isDark: true,
    fontFamily: 'var(--font-fira-code), monospace',
  },
  {
    id: 'forest',
    name: 'Deep Forest',
    background: '#1a2f1c',
    backgroundSecondary: '#243e26',
    backgroundTertiary: '#2f5032',
    foreground: '#e8f5e9',
    foregroundSecondary: '#a5d6a7',
    accent: '#4caf50',
    accentHover: '#66bb6a',
    border: '#2e7d32',
    isDark: true,
    fontFamily: 'var(--font-dm-sans), sans-serif',
  },
];

export type ArticleAgeFilter = 'all' | '1day' | '3days' | '7days';

interface SettingsState {
  themeId: string;
  defaultRefreshInterval: number; // in minutes
  defaultViewMode: 'compact' | 'comfortable';

  showPreviewPanel: boolean;
  articleAgeFilter: ArticleAgeFilter;

  setTheme: (themeId: string) => void;
  setDefaultRefreshInterval: (interval: number) => void;
  setDefaultViewMode: (mode: 'compact' | 'comfortable') => void;

  setShowPreviewPanel: (show: boolean) => void;
  setArticleAgeFilter: (filter: ArticleAgeFilter) => void;

  aiSettings: {
    enabled: boolean;
    sentimentEnabled: boolean;
    provider: 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'minimax' | 'kimi';
    ollamaUrl: string;
    apiKeys: Record<string, string>;
    model: string;
    language: string;
  };
  setAiSettings: (settings: Partial<SettingsState['aiSettings']>) => void;

  briefingSettings: {
    enabled: boolean;
    times: string[];
    telegramEnabled: boolean;
    telegramToken: string;
    telegramChatId: string;
    lastGenerated: string | null;
  };
  setBriefingSettings: (settings: Partial<SettingsState['briefingSettings']>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeId: 'organic',
      defaultRefreshInterval: 10,
      defaultViewMode: 'comfortable',

      showPreviewPanel: true,
      articleAgeFilter: 'all',

      aiSettings: {
        enabled: true,
        sentimentEnabled: true,
        provider: 'ollama',
        ollamaUrl: 'http://localhost:11434',
        apiKeys: {},
        model: 'llama3.2',
        language: 'Original Language',
      },

      setTheme: (themeId) => set({ themeId }),
      setDefaultRefreshInterval: (interval) => set({ defaultRefreshInterval: interval }),
      setDefaultViewMode: (mode) => set({ defaultViewMode: mode }),

      setShowPreviewPanel: (show) => set({ showPreviewPanel: show }),
      setArticleAgeFilter: (filter) => set({ articleAgeFilter: filter }),
      setAiSettings: (newSettings) =>
        set((state) => ({
          aiSettings: { ...state.aiSettings, ...newSettings }
        })),

      briefingSettings: {
        enabled: false,
        times: ['08:00'],
        telegramEnabled: false,
        telegramToken: '',
        telegramChatId: '',
        lastGenerated: null,
      },
      setBriefingSettings: (newSettings) =>
        set((state) => ({
          briefingSettings: { ...state.briefingSettings, ...newSettings }
        })),
    }),
    {
      name: 'rss-deck-settings',
      version: 2,
      migrate: (persistedState: any, version) => {
        if (version === 0) {
          if (persistedState.briefingSettings && !persistedState.briefingSettings.times) {
            persistedState.briefingSettings.times = [persistedState.briefingSettings.time || '08:00'];
          }
        }
        if (version < 2) {
          // Migrate single apiKey to apiKeys map based on current provider
          if (persistedState.aiSettings) {
            const currentKey = persistedState.aiSettings.apiKey || '';
            const provider = persistedState.aiSettings.provider || 'openai';
            persistedState.aiSettings.apiKeys = {
              [provider]: currentKey
            };
            // Clean up old field if possible, though strict typing might ignore it
            delete persistedState.aiSettings.apiKey;
          }
        }
        return persistedState;
      },
    }
  )
);

export function getThemeById(id: string): ThemeColors {
  return themes.find((t) => t.id === id) || themes[0];
}
