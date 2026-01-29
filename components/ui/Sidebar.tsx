'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Rss, PlusCircle, Settings, Bookmark, RefreshCw, Clock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBookmarksStore } from '@/lib/bookmarks-store';
import { useSettingsStore, ArticleAgeFilter } from '@/lib/settings-store';

interface SidebarProps {
  onAddColumn: () => void;
  onOpenSettings: () => void;
  onRefreshAll: () => void;
}

const ageFilterLabels: Record<ArticleAgeFilter, string> = {
  'all': 'All',
  '1day': '1 Day',
  '3days': '3 Days',
  '7days': '7 Days',
};

export function Sidebar({ onAddColumn, onOpenSettings, onRefreshAll }: SidebarProps) {
  const bookmarkCount = useBookmarksStore((state) => state.bookmarks.length);
  const articleAgeFilter = useSettingsStore((state) => state.articleAgeFilter);
  const setArticleAgeFilter = useSettingsStore((state) => state.setArticleAgeFilter);
  const [showAgeMenu, setShowAgeMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    onRefreshAll();
    // Reset after a short delay to show the animation
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  return (
    <div className="w-14 h-full bg-background-secondary border-r border-border flex flex-col items-center py-4 flex-shrink-0">
      {/* Logo */}
      <div className="mb-6">
        <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center">
          <Rss className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-2">
        <SidebarButton
          icon={<PlusCircle className="w-5 h-5" />}
          label="Add Column"
          onClick={onAddColumn}
        />
        <SidebarButton
          icon={<RefreshCw className={cn('w-5 h-5', isRefreshing && 'animate-spin')} />}
          label="Refresh All"
          onClick={handleRefreshAll}
        />
        <Link
          href="/bookmarks"
          title={`Bookmarks${bookmarkCount > 0 ? ` (${bookmarkCount})` : ''}`}
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative',
            'text-foreground-secondary hover:bg-background-tertiary hover:text-foreground'
          )}
        >
          <Bookmark className="w-5 h-5" />
          {bookmarkCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-warning text-background text-xs font-bold rounded-full flex items-center justify-center px-1">
              {bookmarkCount > 99 ? '99+' : bookmarkCount}
            </span>
          )}
        </Link>

        {/* Age Filter */}
        <div className="relative">
          <button
            onClick={() => setShowAgeMenu(!showAgeMenu)}
            title={`Filter: ${ageFilterLabels[articleAgeFilter]}`}
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative',
              articleAgeFilter !== 'all'
                ? 'bg-accent/20 text-accent'
                : 'text-foreground-secondary hover:bg-background-tertiary hover:text-foreground'
            )}
          >
            <Clock className="w-5 h-5" />
            {articleAgeFilter !== 'all' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full" />
            )}
          </button>

          {/* Age Filter Dropdown */}
          {showAgeMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAgeMenu(false)}
              />
              <div className="absolute left-12 top-0 z-50 bg-background-secondary border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
                <div className="px-3 py-1.5 text-xs font-medium text-foreground-secondary border-b border-border">
                  Show articles from
                </div>
                {(Object.keys(ageFilterLabels) as ArticleAgeFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setArticleAgeFilter(filter);
                      setShowAgeMenu(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-sm text-left hover:bg-background-tertiary transition-colors',
                      articleAgeFilter === filter && 'text-accent font-medium'
                    )}
                  >
                    {ageFilterLabels[filter]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center gap-2">
        <SidebarButton
          icon={<Settings className="w-5 h-5" />}
          label="Settings"
          onClick={onOpenSettings}
        />
      </div>
    </div>
  );
}

interface SidebarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
}

function SidebarButton({ icon, label, onClick, active, badge }: SidebarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative',
        active
          ? 'bg-accent text-white'
          : 'text-foreground-secondary hover:bg-background-tertiary hover:text-foreground'
      )}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-warning text-background text-xs font-bold rounded-full flex items-center justify-center px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
