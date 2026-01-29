import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ScrapedContent {
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
  byline: string | null;
  siteName: string | null;
  length: number;
  cachedAt: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  webResults?: { title: string; url: string; snippet: string }[];
}

interface ArticleSummary {
  summary: string;
  relatedArticles: { title: string; source: string; url: string }[];
  webResults: { title: string; url: string; snippet: string }[];
  cachedAt: number;
}

interface ArticleChat {
  messages: ChatMessage[];
  updatedAt: number;
}

interface ArticleCacheState {
  // Scraped content cache (keyed by article URL)
  scrapedContent: Record<string, ScrapedContent>;
  // AI summary cache (keyed by article ID)
  summaries: Record<string, ArticleSummary>;
  // Chat history cache (keyed by article ID)
  chats: Record<string, ArticleChat>;

  // Scraped content actions
  setScrapedContent: (url: string, content: Omit<ScrapedContent, 'cachedAt'>) => void;
  getScrapedContent: (url: string) => ScrapedContent | null;

  // Summary actions
  setSummary: (articleId: string, summary: ArticleSummary) => void;
  getSummary: (articleId: string) => ArticleSummary | null;

  // Chat actions
  setChatMessages: (articleId: string, messages: ChatMessage[]) => void;
  addChatMessage: (articleId: string, message: ChatMessage) => void;
  getChatMessages: (articleId: string) => ChatMessage[];
  clearChat: (articleId: string) => void;

  // Cleanup old cache (older than 7 days)
  cleanupOldCache: () => void;
}

const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export const useArticleCacheStore = create<ArticleCacheState>()(
  persist(
    (set, get) => ({
      scrapedContent: {},
      summaries: {},
      chats: {},

      setScrapedContent: (url, content) =>
        set((state) => ({
          scrapedContent: {
            ...state.scrapedContent,
            [url]: { ...content, cachedAt: Date.now() },
          },
        })),

      getScrapedContent: (url) => {
        const content = get().scrapedContent[url];
        if (!content) return null;
        // Check if cache is still valid
        if (Date.now() - content.cachedAt > CACHE_MAX_AGE) {
          return null;
        }
        return content;
      },

      setSummary: (articleId, summary) =>
        set((state) => ({
          summaries: {
            ...state.summaries,
            [articleId]: { ...summary, cachedAt: Date.now() },
          },
        })),

      getSummary: (articleId) => {
        const summary = get().summaries[articleId];
        if (!summary) return null;
        if (Date.now() - summary.cachedAt > CACHE_MAX_AGE) {
          return null;
        }
        return summary;
      },

      setChatMessages: (articleId, messages) =>
        set((state) => ({
          chats: {
            ...state.chats,
            [articleId]: { messages, updatedAt: Date.now() },
          },
        })),

      addChatMessage: (articleId, message) =>
        set((state) => {
          const existingChat = state.chats[articleId];
          const messages = existingChat ? [...existingChat.messages, message] : [message];
          return {
            chats: {
              ...state.chats,
              [articleId]: { messages, updatedAt: Date.now() },
            },
          };
        }),

      getChatMessages: (articleId) => {
        const chat = get().chats[articleId];
        if (!chat) return [];
        if (Date.now() - chat.updatedAt > CACHE_MAX_AGE) {
          return [];
        }
        return chat.messages;
      },

      clearChat: (articleId) =>
        set((state) => {
          const { [articleId]: _, ...remainingChats } = state.chats;
          return { chats: remainingChats };
        }),

      cleanupOldCache: () =>
        set((state) => {
          const now = Date.now();

          const scrapedContent: Record<string, ScrapedContent> = {};
          for (const [url, content] of Object.entries(state.scrapedContent)) {
            if (now - content.cachedAt < CACHE_MAX_AGE) {
              scrapedContent[url] = content;
            }
          }

          const summaries: Record<string, ArticleSummary> = {};
          for (const [id, summary] of Object.entries(state.summaries)) {
            if (now - summary.cachedAt < CACHE_MAX_AGE) {
              summaries[id] = summary;
            }
          }

          const chats: Record<string, ArticleChat> = {};
          for (const [id, chat] of Object.entries(state.chats)) {
            if (now - chat.updatedAt < CACHE_MAX_AGE) {
              chats[id] = chat;
            }
          }

          return { scrapedContent, summaries, chats };
        }),
    }),
    {
      name: 'rss-deck-article-cache',
    }
  )
);
