import { create } from 'zustand';

interface ReadArticlesState {
  readIds: Set<string>;
  hydrateReadIds: (ids: string[]) => void;
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  isRead: (id: string) => boolean;
}

function persistMarkRead(articleId: string) {
  if (typeof window === 'undefined') return;
  void fetch('/api/articles/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleId }),
  }).catch((err) => {
    console.error('Failed to persist read state:', err);
  });
}

function persistMarkAllRead(articleIds: string[]) {
  if (typeof window === 'undefined') return;
  void fetch('/api/articles/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleIds }),
  }).catch((err) => {
    console.error('Failed to persist read state:', err);
  });
}

export const useReadArticlesStore = create<ReadArticlesState>()((set, get) => ({
  readIds: new Set<string>(),

  hydrateReadIds: (ids) => set({ readIds: new Set(ids) }),

  markRead: (id) => {
    if (get().readIds.has(id)) return;
    persistMarkRead(id);
    set((state) => ({ readIds: new Set([...state.readIds, id]) }));
  },

  markAllRead: (ids) => {
    const unread = ids.filter((id) => !get().readIds.has(id));
    if (unread.length === 0) return;
    persistMarkAllRead(unread);
    set((state) => ({ readIds: new Set([...state.readIds, ...unread]) }));
  },

  isRead: (id) => get().readIds.has(id),
}));
