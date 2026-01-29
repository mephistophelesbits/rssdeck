import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Article } from './types';

interface BookmarksState {
  bookmarks: Article[];
  addBookmark: (article: Article) => void;
  removeBookmark: (articleId: string) => void;
  isBookmarked: (articleId: string) => boolean;
  toggleBookmark: (article: Article) => void;
}

export const useBookmarksStore = create<BookmarksState>()(
  persist(
    (set, get) => ({
      bookmarks: [],

      addBookmark: (article) =>
        set((state) => {
          if (state.bookmarks.some((b) => b.id === article.id)) {
            return state;
          }
          return {
            bookmarks: [{ ...article, bookmarked: true }, ...state.bookmarks],
          };
        }),

      removeBookmark: (articleId) =>
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== articleId),
        })),

      isBookmarked: (articleId) => {
        return get().bookmarks.some((b) => b.id === articleId);
      },

      toggleBookmark: (article) => {
        const state = get();
        if (state.bookmarks.some((b) => b.id === article.id)) {
          state.removeBookmark(article.id);
        } else {
          state.addBookmark(article);
        }
      },
    }),
    {
      name: 'rss-deck-bookmarks',
    }
  )
);
