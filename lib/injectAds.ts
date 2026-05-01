import { Article, AdSentinel, FeedItem } from './types';

export function injectAds(articles: Article[]): FeedItem[] {
  const result: FeedItem[] = [];
  articles.forEach((article, i) => {
    result.push(article);
    if ((i + 1) % 10 === 0) {
      result.push({ type: 'ad', id: `ad-${i}` } satisfies AdSentinel);
    }
  });
  return result;
}
