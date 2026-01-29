'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Sidebar } from '@/components/ui/Sidebar';
import { DeckContainer } from '@/components/deck/DeckContainer';
import { AddFeedModal } from '@/components/ui/AddFeedModal';
import { SettingsModal } from '@/components/ui/SettingsModal';
import { ArticlePreviewPanel } from '@/components/ui/ArticlePreviewPanel';
import { StockTicker } from '@/components/ui/StockTicker';
import { ThemeProvider } from '@/components/ThemeProvider';
import { StoreHydration } from '@/components/StoreHydration';
import { UrlPreviewProvider } from '@/components/ui/UrlPreviewPopup';
import { BriefingManager } from '@/components/BriefingManager';
import { useArticlesStore } from '@/lib/articles-store';
import { useDeckStore, DEFAULT_COLUMN_WIDTH } from '@/lib/store';
import { Article } from '@/lib/types';

const MIN_PANEL_WIDTH = 300;
const DEFAULT_PREVIEW_WIDTH = 50; // percentage

export default function Home() {
  const [isAddFeedModalOpen, setIsAddFeedModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_PREVIEW_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const articlesByColumn = useArticlesStore((state) => state.articlesByColumn);
  const articleToColumn = useArticlesStore((state) => state.articleToColumn);
  const columns = useDeckStore((state) => state.columns);

  // Calculate the total width needed by all columns plus the "Add" placeholder (60px)
  const totalColumnsWidth = columns.reduce((acc, col) => acc + (col.width || DEFAULT_COLUMN_WIDTH), 0) + 60;

  const openAddFeedModal = () => setIsAddFeedModalOpen(true);
  const closeAddFeedModal = () => setIsAddFeedModalOpen(false);

  const openSettingsModal = () => setIsSettingsModalOpen(true);
  const closeSettingsModal = () => setIsSettingsModalOpen(false);

  // Refresh all trigger - increment to force re-fetch
  const [refreshAllTrigger, setRefreshAllTrigger] = useState(0);
  const handleRefreshAll = () => {
    setRefreshAllTrigger((prev) => prev + 1);
  };

  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article);
  };

  const closeArticlePreview = () => {
    setSelectedArticle(null);
  };

  // Keyboard navigation for articles
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if a modal is open or no article is selected
      if (isAddFeedModalOpen || isSettingsModalOpen) return;
      if (!selectedArticle) return;

      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();

        // Find which column this article belongs to
        const columnId = articleToColumn.get(selectedArticle.id);
        if (!columnId) return;

        // Get articles from the same column
        const columnArticles = articlesByColumn.get(columnId);
        if (!columnArticles || columnArticles.length === 0) return;

        const currentIndex = columnArticles.findIndex(
          (article) => article.id === selectedArticle.id
        );

        if (currentIndex === -1) return;

        let newIndex: number;
        if (e.key === 'ArrowUp') {
          // Go to previous (above) article in the column
          newIndex = currentIndex - 1;
          if (newIndex < 0) newIndex = columnArticles.length - 1; // Wrap to end
        } else {
          // Go to next (below) article in the column
          newIndex = currentIndex + 1;
          if (newIndex >= columnArticles.length) newIndex = 0; // Wrap to start
        }

        setSelectedArticle(columnArticles[newIndex]);
      }

      // Escape to close preview
      if (e.key === 'Escape') {
        setSelectedArticle(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedArticle, articlesByColumn, articleToColumn, isAddFeedModalOpen, isSettingsModalOpen]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const mouseX = e.clientX - rect.left;

      // Calculate the new preview width as a percentage
      const feedsWidth = mouseX;
      const newPreviewPercent = ((containerWidth - feedsWidth) / containerWidth) * 100;

      // Ensure minimum widths
      const minPercent = (MIN_PANEL_WIDTH / containerWidth) * 100;
      const maxPercent = 100 - minPercent;

      const clampedPercent = Math.max(minPercent, Math.min(maxPercent, newPreviewPercent));
      setPreviewWidth(clampedPercent);
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <ThemeProvider>
      <StoreHydration>
        <UrlPreviewProvider>
          <BriefingManager />
          <div className="flex flex-col h-screen bg-background overflow-hidden">
            {/* Stock Ticker Bar */}
            <StockTicker />

            {/* Main Content */}
            <main
              className="flex flex-1 overflow-hidden"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <Sidebar
                onAddColumn={openAddFeedModal}
                onOpenSettings={openSettingsModal}
                onRefreshAll={handleRefreshAll}
              />
              {/* Main content area - resizable split */}
              <div
                ref={containerRef}
                className="flex-1 flex overflow-hidden relative"
              >
                {/* Left side - Feed columns */}
                <div
                  className="h-full overflow-hidden flex-shrink-0 border-r border-border"
                  style={{
                    // The deck takes its calculated width if an article is selected, 
                    // but never more than 75% of the available space.
                    // If no article is selected, it takes 100%.
                    width: selectedArticle ? `min(${totalColumnsWidth}px, 75%)` : '100%',
                    transition: isDragging ? 'none' : 'width 0.3s ease-in-out'
                  }}
                >
                  <DeckContainer
                    onAddColumn={openAddFeedModal}
                    onArticleClick={handleArticleClick}
                    selectedArticleId={selectedArticle?.id || null}
                    refreshTrigger={refreshAllTrigger}
                  />
                </div>

                {selectedArticle && (
                  <>
                    {/* Resize Handle - can still be used to override the auto-width if desired */}
                    <div
                      className={`w-1 h-full bg-border hover:bg-accent cursor-col-resize flex-shrink-0 transition-colors ${isDragging ? 'bg-accent' : ''
                        }`}
                      onMouseDown={handleMouseDown}
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-0.5 h-8 bg-foreground-secondary/30 rounded-full" />
                      </div>
                    </div>

                    {/* Right side - Preview panel */}
                    <div
                      className="h-full overflow-hidden flex-1"
                      style={{
                        transition: isDragging ? 'none' : 'width 0.3s ease-in-out'
                      }}
                    >
                      <ArticlePreviewPanel
                        article={selectedArticle}
                        onClose={closeArticlePreview}
                      />
                    </div>
                  </>
                )}

                {/* Overlay during drag to prevent text selection */}
                {isDragging && (
                  <div className="absolute inset-0 z-50 cursor-col-resize" />
                )}
              </div>
              <AddFeedModal isOpen={isAddFeedModalOpen} onClose={closeAddFeedModal} />
              <SettingsModal isOpen={isSettingsModalOpen} onClose={closeSettingsModal} />
            </main>
          </div>
        </UrlPreviewProvider>
      </StoreHydration>
    </ThemeProvider>
  );
}
