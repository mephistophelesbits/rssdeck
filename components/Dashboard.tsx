'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/ui/Sidebar';
import { DeckContainer } from '@/components/deck/DeckContainer';
import { AddFeedModal } from '@/components/ui/AddFeedModal';
import { SettingsModal } from '@/components/ui/SettingsModal';
import { StockTicker } from '@/components/ui/StockTicker';
import { ThemeProvider } from '@/components/ThemeProvider';
import { StoreHydration } from '@/components/StoreHydration';
import { UrlPreviewProvider } from '@/components/ui/UrlPreviewPopup';
import { BriefingManager } from '@/components/BriefingManager';
import { useArticlesStore } from '@/lib/articles-store';
import { Article } from '@/lib/types';

export function Dashboard() {
    const [isAddFeedModalOpen, setIsAddFeedModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [refreshAllTrigger, setRefreshAllTrigger] = useState(0);

    const articlesByColumn = useArticlesStore((state) => state.articlesByColumn);
    const articleToColumn = useArticlesStore((state) => state.articleToColumn);

    const openAddFeedModal = () => setIsAddFeedModalOpen(true);
    const closeAddFeedModal = () => setIsAddFeedModalOpen(false);

    const openSettingsModal = () => setIsSettingsModalOpen(true);
    const closeSettingsModal = () => setIsSettingsModalOpen(false);

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

    return (
        <ThemeProvider>
            <StoreHydration>
                <UrlPreviewProvider>
                    <BriefingManager />
                    <div className="flex flex-col h-screen bg-background overflow-hidden">
                        {/* Stock Ticker Bar */}
                        <StockTicker />

                        {/* Main Content */}
                        <main className="flex flex-1 overflow-hidden">
                            <Sidebar
                                onAddColumn={openAddFeedModal}
                                onOpenSettings={openSettingsModal}
                                onRefreshAll={handleRefreshAll}
                            />
                            {/* Main content area */}
                            <div className="flex-1 flex overflow-hidden relative">
                                <DeckContainer
                                    onAddColumn={openAddFeedModal}
                                    onArticleClick={handleArticleClick}
                                    onCloseArticle={closeArticlePreview}
                                    selectedArticle={selectedArticle}
                                    refreshTrigger={refreshAllTrigger}
                                />
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
