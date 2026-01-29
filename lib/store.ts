import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Column, FeedSource } from './types';

export const DEFAULT_COLUMN_WIDTH = 350;
export const MIN_COLUMN_WIDTH = 280;
export const MAX_COLUMN_WIDTH = 600;

interface DeckState {
  columns: Column[];
  addColumn: (column: Column) => void;
  removeColumn: (columnId: string) => void;
  updateColumn: (columnId: string, updates: Partial<Column>) => void;
  setColumnWidth: (columnId: string, width: number) => void;
  addFeedToColumn: (columnId: string, feed: FeedSource) => void;
  removeFeedFromColumn: (columnId: string, feedId: string) => void;
  moveColumn: (fromIndex: number, toIndex: number) => void;
  reorderColumns: (newOrder: string[]) => void;

  // Custom Feeds persistence
  savedFeeds: FeedSource[];
  addSavedFeed: (feed: FeedSource) => void;
  removeSavedFeed: (feedId: string) => void;
  updateSavedFeed: (feedId: string, updates: Partial<FeedSource>) => void;
}

// Migration function to ensure all columns have required fields
function migrateColumns(columns: Column[]): Column[] {
  return columns.map((col) => ({
    ...col,
    width: col.width || DEFAULT_COLUMN_WIDTH,
  }));
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set) => ({
      columns: [
        {
          id: 'col-world-en',
          title: 'World News (EN)',
          type: 'unified',
          sources: [
            { id: 'bbc', url: 'http://feeds.bbci.co.uk/news/rss.xml', title: 'BBC News' },
            { id: 'reuters', url: 'https://www.reutersagency.com/feed/', title: 'Reuters' }
          ],
          settings: { refreshInterval: 10, viewMode: 'comfortable' },
          width: DEFAULT_COLUMN_WIDTH,
        },
        {
          id: 'col-tech-en',
          title: 'Tech News (EN)',
          type: 'unified',
          sources: [
            { id: 'hn', url: 'https://hnrss.org/frontpage', title: 'Hacker News' },
            { id: 'verge', url: 'https://www.theverge.com/rss/index.xml', title: 'The Verge' }
          ],
          settings: { refreshInterval: 10, viewMode: 'comfortable' },
          width: DEFAULT_COLUMN_WIDTH,
        },
        {
          id: 'col-world-zh',
          title: '世界新闻 (ZH)',
          type: 'unified',
          sources: [
            { id: 'bbc-zh', url: 'https://www.bbc.com/zhongwen/simp/index.xml', title: 'BBC 中文' },
            { id: 'zaobao', url: 'https://www.zaobao.com.sg/rss/realtime/china', title: '联合早报' }
          ],
          settings: { refreshInterval: 10, viewMode: 'comfortable' },
          width: DEFAULT_COLUMN_WIDTH,
        },
        {
          id: 'col-tech-zh',
          title: '科技资讯 (ZH)',
          type: 'unified',
          sources: [
            { id: '36kr', url: 'https://36kr.com/feed', title: '36Kr' },
            { id: 'sspai', url: 'https://sspai.com/feed', title: '少数派' }
          ],
          settings: { refreshInterval: 10, viewMode: 'comfortable' },
          width: DEFAULT_COLUMN_WIDTH,
        }
      ],
      savedFeeds: [],

      addSavedFeed: (feed) =>
        set((state) => {
          // Prevent duplicates by URL
          if (state.savedFeeds.some(f => f.url === feed.url)) return state;
          return { savedFeeds: [feed, ...state.savedFeeds] };
        }),

      removeSavedFeed: (feedId) =>
        set((state) => ({
          savedFeeds: state.savedFeeds.filter((f) => f.id !== feedId),
        })),

      updateSavedFeed: (feedId, updates) =>
        set((state) => ({
          savedFeeds: state.savedFeeds.map((f) =>
            f.id === feedId ? { ...f, ...updates } : f
          ),
        })),

      addColumn: (column) =>
        set((state) => ({
          columns: [...state.columns, { ...column, width: column.width || DEFAULT_COLUMN_WIDTH }],
        })),

      removeColumn: (columnId) =>
        set((state) => ({
          columns: state.columns.filter((col) => col.id !== columnId),
        })),



      updateColumn: (columnId, updates) =>
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === columnId ? { ...col, ...updates } : col
          ),
        })),

      setColumnWidth: (columnId, width) =>
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === columnId
              ? { ...col, width: Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, width)) }
              : col
          ),
        })),

      addFeedToColumn: (columnId, feed) =>
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === columnId
              ? { ...col, sources: [...col.sources, feed] }
              : col
          ),
        })),

      removeFeedFromColumn: (columnId, feedId) =>
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === columnId
              ? { ...col, sources: col.sources.filter((f) => f.id !== feedId) }
              : col
          ),
        })),

      moveColumn: (fromIndex, toIndex) =>
        set((state) => {
          const newColumns = [...state.columns];
          const [removed] = newColumns.splice(fromIndex, 1);
          newColumns.splice(toIndex, 0, removed);
          return { columns: newColumns };
        }),

      reorderColumns: (newOrder) =>
        set((state) => {
          const columnMap = new Map(state.columns.map((col) => [col.id, col]));
          const reorderedColumns = newOrder
            .map((id) => columnMap.get(id))
            .filter((col): col is Column => col !== undefined);
          return { columns: reorderedColumns };
        }),
    }),
    {
      name: 'rss-deck-storage',
      // Migrate old data on rehydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.columns = migrateColumns(state.columns);
          state.savedFeeds = state.savedFeeds || [];
        }
      },
    }
  )
);
