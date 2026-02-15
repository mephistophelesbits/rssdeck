import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SummaryCache {
  [articleId: string]: {
    summary: string;
    timestamp: number;
    enhancedMode?: boolean;
  };
}

interface NotificationLog {
  articleId: string;
  sentAt: number;
  title: string;
}

interface RSSDeckState {
  // Summary cache to avoid re-summarizing articles
  summaryCache: SummaryCache;
  
  // Notification tracking for rate limiting & deduplication
  notificationLog: NotificationLog[];
  lastNotificationSent: number;
  
  // OPML import state
  opmlImportProgress: number | null;
  
  // Actions
  getSummary: (articleId: string) => { summary: string; timestamp: number } | null;
  setSummary: (articleId: string, summary: string, enhancedMode?: boolean) => void;
  clearSummaryCache: () => void;
  
  // Notification actions
  shouldSendNotification: (articleId: string) => boolean;
  logNotification: (articleId: string, title: string) => void;
  getRecentNotifications: (hours: number) => NotificationLog[];
  clearNotificationLog: () => void;
  
  // OPML actions
  setOpmlImportProgress: (progress: number | null) => void;
}

const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const NOTIFICATION_RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour between notifications per article

export const useRSSDeckStore = create<RSSDeckState>()(
  persist(
    (set, get) => ({
      summaryCache: {},
      notificationLog: [],
      lastNotificationSent: 0,
      opmlImportProgress: null,
      
      getSummary: (articleId) => {
        const cache = get().summaryCache[articleId];
        if (!cache) return null;
        
        // Check if expired
        if (Date.now() - cache.timestamp > CACHE_EXPIRY_MS) {
          return null;
        }
        
        return { summary: cache.summary, timestamp: cache.timestamp };
      },
      
      setSummary: (articleId, summary, enhancedMode) => {
        set((state) => ({
          summaryCache: {
            ...state.summaryCache,
            [articleId]: {
              summary,
              timestamp: Date.now(),
              enhancedMode,
            },
          },
        }));
      },
      
      clearSummaryCache: () => set({ summaryCache: {} }),
      
      shouldSendNotification: (articleId) => {
        const log = get().notificationLog;
        const recent = log.filter(
          (n) => n.articleId === articleId && 
          Date.now() - n.sentAt < NOTIFICATION_RATE_LIMIT_MS
        );
        
        // Don't send if we've sent this article recently
        if (recent.length > 0) return false;
        
        // Also check rate limit for ANY notification
        const timeSinceLast = Date.now() - get().lastNotificationSent;
        if (timeSinceLast < 60000) return false; // Max 1 per minute
        
        return true;
      },
      
      logNotification: (articleId, title) => {
        set((state) => ({
          notificationLog: [
            ...state.notificationLog,
            { articleId, title, sentAt: Date.now() },
          ].slice(-100), // Keep last 100
          lastNotificationSent: Date.now(),
        }));
      },
      
      getRecentNotifications: (hours) => {
        const cutoff = Date.now() - hours * 60 * 60 * 1000;
        return get().notificationLog.filter((n) => n.sentAt > cutoff);
      },
      
      clearNotificationLog: () => set({ notificationLog: [], lastNotificationSent: 0 }),
      
      setOpmlImportProgress: (progress) => set({ opmlImportProgress: progress }),
    }),
    {
      name: 'rss-deck-extensions',
      version: 1,
    }
  )
);
