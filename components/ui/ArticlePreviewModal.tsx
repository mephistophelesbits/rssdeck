'use client';

import { useEffect } from 'react';
import { X, ExternalLink, Calendar, User } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import DOMPurify from 'dompurify';
import { Article } from '@/lib/types';
import { decodeHtml } from '@/lib/utils';

interface ArticlePreviewModalProps {
  article: Article | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ArticlePreviewModal({ article, isOpen, onClose }: ArticlePreviewModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !article) return null;

  const timeAgo = formatDistanceToNow(new Date(article.pubDate), { addSuffix: true });
  const formattedDate = format(new Date(article.pubDate), 'MMMM d, yyyy • h:mm a');

  // Sanitize HTML content
  const sanitizedContent = article.content
    ? DOMPurify.sanitize(article.content, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'figure', 'figcaption', 'pre', 'code'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
      ADD_ATTR: ['target'],
    })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background-secondary border border-border rounded-xl w-full max-w-2xl max-h-[85vh] mx-4 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background-tertiary flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-foreground-secondary">
            {article.sourceTitle && (
              <span className="font-medium text-accent">{decodeHtml(article.sourceTitle)}</span>
            )}
            <span>•</span>
            <span>{timeAgo}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-background-secondary rounded transition-colors text-foreground-secondary hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 column-scroll">
          {/* Thumbnail */}
          {article.thumbnail && (
            <div className="mb-4 -mx-6 -mt-6">
              <img
                src={article.thumbnail}
                alt=""
                className="w-full h-48 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Title */}
          <h1 className="text-xl font-bold text-foreground leading-tight mb-4">
            {decodeHtml(article.title)}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-foreground-secondary mb-6">
            {article.author && (
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>{decodeHtml(article.author)}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* Article Content */}
          {sanitizedContent ? (
            <div
              className="prose prose-invert prose-sm max-w-none
                prose-headings:text-foreground prose-headings:font-semibold
                prose-p:text-foreground-secondary prose-p:leading-relaxed
                prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                prose-strong:text-foreground
                prose-blockquote:border-l-accent prose-blockquote:text-foreground-secondary
                prose-code:text-accent prose-code:bg-background-tertiary prose-code:px-1 prose-code:rounded
                prose-pre:bg-background-tertiary
                prose-img:rounded-lg prose-img:max-w-full"
              dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />
          ) : article.contentSnippet ? (
            <p className="text-foreground-secondary leading-relaxed">
              {decodeHtml(article.contentSnippet)}
            </p>
          ) : (
            <p className="text-foreground-secondary italic">
              No content preview available.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-background-tertiary">
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Read Original Article
          </a>
        </div>
      </div>
    </div>
  );
}
