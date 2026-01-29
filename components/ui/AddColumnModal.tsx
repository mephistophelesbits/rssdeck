'use client';

import { useState } from 'react';
import { X, Loader2, Check, Link2, Folder } from 'lucide-react';
import { useDeckStore, DEFAULT_COLUMN_WIDTH } from '@/lib/store';
import { useSettingsStore } from '@/lib/settings-store';
import { categories, Category } from '@/lib/categories';
import { cn, generateId } from '@/lib/utils';

interface AddColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'url' | 'categories';

export function AddColumnModal({ isOpen, onClose }: AddColumnModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('categories');
  const [url, setUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addColumn = useDeckStore((state) => state.addColumn);
  const { defaultRefreshInterval, defaultViewMode } = useSettingsStore();

  if (!isOpen) return null;

  const handleAddCustomFeed = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const res = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('Invalid feed');

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      addColumn({
        id: generateId(),
        title: data.title || 'Custom Feed',
        type: 'single-feed',
        sources: [
          {
            id: generateId(),
            url: url,
            title: data.title || 'Custom Feed',
          },
        ],
        settings: {
          refreshInterval: defaultRefreshInterval,
          viewMode: defaultViewMode,
        },
        width: DEFAULT_COLUMN_WIDTH,
      });

      setUrl('');
      onClose();
    } catch (err) {
      setError('Failed to validate feed. Please check the URL.');
      console.error(err);
    } finally {
      setIsValidating(false);
    }
  };

  const handleAddCategory = (category: Category) => {
    addColumn({
      id: generateId(),
      title: category.name,
      type: 'category',
      sources: category.feeds.map((feed) => ({
        ...feed,
        id: generateId(),
      })),
      settings: {
        refreshInterval: defaultRefreshInterval,
        viewMode: defaultViewMode,
      },
      width: DEFAULT_COLUMN_WIDTH,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background-secondary border border-border rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">Add Column</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-background-tertiary rounded transition-colors text-foreground-secondary hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('categories')}
            className={cn(
              'flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2',
              activeTab === 'categories'
                ? 'text-accent border-b-2 border-accent'
                : 'text-foreground-secondary hover:text-foreground'
            )}
          >
            <Folder className="w-4 h-4" />
            Categories
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={cn(
              'flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2',
              activeTab === 'url'
                ? 'text-accent border-b-2 border-accent'
                : 'text-foreground-secondary hover:text-foreground'
            )}
          >
            <Link2 className="w-4 h-4" />
            Custom URL
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === 'categories' ? (
            <div className="grid grid-cols-2 gap-3">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleAddCategory(category)}
                  className="flex flex-col items-start p-3 rounded-lg border border-border hover:border-accent hover:bg-background-tertiary transition-all text-left group"
                >
                  <span className="text-2xl mb-2">{category.icon}</span>
                  <span className="font-medium text-sm group-hover:text-accent transition-colors">
                    {category.name}
                  </span>
                  <span className="text-xs text-foreground-secondary mt-0.5">
                    {category.feeds.length} feeds
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  RSS Feed URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  placeholder="https://example.com/feed.xml"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-foreground-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCustomFeed();
                  }}
                />
                {error && (
                  <p className="text-sm text-error mt-2">{error}</p>
                )}
              </div>

              <button
                onClick={handleAddCustomFeed}
                disabled={isValidating || !url.trim()}
                className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Add Feed
                  </>
                )}
              </button>

              <p className="text-xs text-foreground-secondary text-center">
                Enter the URL of any RSS or Atom feed
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
