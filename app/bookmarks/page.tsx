'use client';

import { useState } from 'react';
import { Bookmark, Trash2, ExternalLink, ArrowLeft, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useBookmarksStore } from '@/lib/bookmarks-store';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { ThemeProvider } from '@/components/ThemeProvider';
import { StoreHydration } from '@/components/StoreHydration';
import { UrlPreviewProvider } from '@/components/ui/UrlPreviewPopup';
import { StockTicker } from '@/components/ui/StockTicker';
import { ArticlePreviewPanel } from '@/components/ui/ArticlePreviewPanel';
import { Article } from '@/lib/types';
import { decodeHtml } from '@/lib/utils';

export default function BookmarksPage() {
  const router = useRouter();
  const { bookmarks, removeBookmark } = useBookmarksStore();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBookmarks = bookmarks.filter((article) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      article.title.toLowerCase().includes(query) ||
      article.sourceTitle?.toLowerCase().includes(query) ||
      article.contentSnippet?.toLowerCase().includes(query)
    );
  });

  return (
    <ThemeProvider>
      <StoreHydration>
        <UrlPreviewProvider>
          <div className="flex flex-col h-screen bg-background overflow-hidden">
            {/* Stock Ticker Bar */}
            <StockTicker />

            {/* Main Content */}
            <main className="flex flex-1 overflow-hidden">
              {/* Left side - Bookmarks list */}
              <div className="flex-1 flex flex-col h-full border-r border-border">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background-secondary flex-shrink-0">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => router.push('/')}
                      className="p-2 hover:bg-background-tertiary rounded-lg transition-colors text-foreground-secondary hover:text-foreground"
                      title="Back to feeds"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-6 h-6 text-warning" />
                      <h1 className="text-xl font-bold">Bookmarks</h1>
                      <span className="text-sm text-foreground-secondary">
                        ({bookmarks.length} saved)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-border bg-background-secondary">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary" />
                    <input
                      type="text"
                      placeholder="Search bookmarks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:border-accent focus:outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto column-scroll">
                  {filteredBookmarks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-foreground-secondary">
                      <Bookmark className="w-16 h-16 mb-4 opacity-30" />
                      {bookmarks.length === 0 ? (
                        <>
                          <p className="text-lg font-medium">No Bookmarks Yet</p>
                          <p className="text-sm mt-2 opacity-70">
                            Click the bookmark icon on any article to save it
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-medium">No Results</p>
                          <p className="text-sm mt-2 opacity-70">
                            No bookmarks match "{searchQuery}"
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredBookmarks.map((article) => (
                        <div
                          key={article.id}
                          className={`p-4 hover:bg-background-tertiary transition-colors group cursor-pointer ${selectedArticle?.id === article.id ? 'bg-accent/20 border-l-2 border-l-accent' : ''
                            }`}
                          onClick={() => setSelectedArticle(article)}
                        >
                          <div className="flex gap-4">
                            {article.thumbnail && (
                              <div className="flex-shrink-0">
                                <img
                                  src={article.thumbnail}
                                  alt=""
                                  className="w-24 h-24 object-cover rounded-lg"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-foreground group-hover:text-accent transition-colors line-clamp-2 text-base">
                                {decodeHtml(article.title)}
                              </h3>
                              {article.contentSnippet && (
                                <p className="text-sm text-foreground-secondary mt-2 line-clamp-2">
                                  {decodeHtml(article.contentSnippet)}
                                </p>
                              )}
                              <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center gap-2 text-xs">
                                  {article.sourceTitle && (
                                    <>
                                      <span className="text-accent font-medium truncate max-w-[150px]">
                                        {decodeHtml(article.sourceTitle)}
                                      </span>
                                      <span className="text-foreground-secondary">·</span>
                                    </>
                                  )}
                                  <RelativeTime date={article.pubDate} className="text-warning font-medium" />
                                </div>
                                <div className="flex items-center gap-1">
                                  <a
                                    href={article.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded hover:bg-background text-foreground-secondary hover:text-accent transition-colors"
                                    title="Open original"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeBookmark(article.id);
                                      if (selectedArticle?.id === article.id) {
                                        setSelectedArticle(null);
                                      }
                                    }}
                                    className="p-1.5 rounded hover:bg-background text-foreground-secondary hover:text-error transition-colors"
                                    title="Remove bookmark"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right side - Preview panel */}
              <div className="w-1/2 h-full">
                <ArticlePreviewPanel
                  article={selectedArticle}
                  onClose={() => setSelectedArticle(null)}
                />
              </div>
            </main>
          </div>
        </UrlPreviewProvider>
      </StoreHydration>
    </ThemeProvider>
  );
}
