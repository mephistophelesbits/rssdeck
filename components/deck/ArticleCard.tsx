import { useState } from 'react';
import { Bookmark, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Article } from '@/lib/types';
import { useBookmarksStore } from '@/lib/bookmarks-store';
import { useSettingsStore } from '@/lib/settings-store';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { cn, decodeHtml } from '@/lib/utils';


interface ArticleCardProps {
  article: Article;
  viewMode?: 'compact' | 'comfortable';
  onClick: (article: Article) => void;
  isSelected?: boolean;
}



export function ArticleCard({ article, viewMode = 'comfortable', onClick, isSelected = false }: ArticleCardProps) {
  const { isBookmarked, toggleBookmark } = useBookmarksStore();
  const bookmarked = isBookmarked(article.id);
  const { aiSettings } = useSettingsStore();

  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);


  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmark(article);
  };

  const handleSummarize = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (showSummary && summary) {
      setShowSummary(false);
      return;
    }

    if (summary) {
      setShowSummary(true);
      return;
    }

    if (!aiSettings.enabled) {
      alert('AI Summary is disabled. Enable it in Settings.');
      return;
    }

    setIsSummarizing(true);
    setShowSummary(true);

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          content: article.content || article.contentSnippet || '',
          provider: aiSettings.provider,
          apiKey: aiSettings.apiKey,
          ollamaUrl: aiSettings.ollamaUrl,
          model: aiSettings.model,
          language: aiSettings.language,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSummary(data.summary);
    } catch (err: any) {
      setSummary(`Error: ${err.message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <button
      onClick={() => onClick(article)}
      className={cn(
        'w-full text-left p-3 border-b border-border hover:bg-background-tertiary transition-colors group relative article-card',
        viewMode === 'compact' && 'py-2',
        isSelected && 'bg-accent/20 border-l-2 border-l-accent'
      )}
    >
      <div className="flex gap-3">
        {article.thumbnail && viewMode === 'comfortable' && (
          <div className="flex-shrink-0">
            <img
              src={article.thumbnail}
              alt=""
              className="w-16 h-16 object-cover rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">

            <h3
              className={cn(
                'font-medium text-foreground group-hover:text-accent transition-colors line-clamp-2 pr-6',
                viewMode === 'compact' ? 'text-sm' : 'text-base'
              )}
            >
              {decodeHtml(article.title)}
            </h3>
          </div>
          {article.contentSnippet && viewMode === 'comfortable' && (
            <p className="text-sm text-foreground-secondary mt-1 line-clamp-2">
              {decodeHtml(article.contentSnippet)}
            </p>
          )}

          {/* AI Summary Display */}
          {showSummary && (
            <div
              className="mt-3 p-3 bg-background-secondary rounded-lg border border-border text-sm text-foreground animate-in fade-in slide-in-from-top-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-2 text-accent font-medium text-xs uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                AI Summary
              </div>
              {isSummarizing ? (
                <div className="flex items-center gap-2 text-foreground-secondary">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating summary...
                </div>
              ) : (
                <div className="text-foreground-secondary">
                  <ReactMarkdown
                    components={{
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                      li: ({ children }) => <li className="text-foreground-secondary">{children}</li>,
                      p: ({ children }) => <p className="my-1">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      h1: ({ children }) => <h1 className="text-base font-bold text-foreground mt-2 mb-1">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-sm font-bold text-foreground mt-2 mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>,
                      a: ({ href, children }) => <a href={href} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      code: ({ children }) => <code className="bg-background-tertiary px-1 py-0.5 rounded text-xs">{children}</code>,
                    }}
                  >
                    {summary || ''}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-1.5 text-xs">
            {article.sourceTitle && (
              <>
                <span className="truncate max-w-[120px] text-accent font-medium">
                  {decodeHtml(article.sourceTitle)}
                </span>
                <span className="text-foreground-secondary">·</span>
              </>
            )}
            <TimeAgo date={article.pubDate} className="text-warning font-medium" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {/* Bookmark button */}
        <div
          onClick={handleBookmarkClick}
          className={cn(
            'p-1.5 rounded transition-all',
            bookmarked
              ? 'text-warning bg-warning/10'
              : 'text-foreground-secondary opacity-0 group-hover:opacity-100 hover:text-warning hover:bg-warning/10'
          )}
          title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
        >
          <Bookmark className={cn('w-4 h-4', bookmarked && 'fill-current')} />
        </div>

        {/* AI Summary button */}
        <div
          onClick={handleSummarize}
          className={cn(
            'p-1.5 rounded transition-all',
            showSummary
              ? 'text-accent bg-accent/10 opacity-100'
              : 'text-foreground-secondary opacity-0 group-hover:opacity-100 hover:text-accent hover:bg-accent/10'
          )}
          title="Generate AI Summary"
        >
          <Sparkles className={cn('w-4 h-4', showSummary && 'fill-current')} />
        </div>
      </div>
    </button>
  );
}
