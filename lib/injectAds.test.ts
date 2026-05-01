import { describe, it, expect } from 'vitest';
import { injectAds } from './injectAds';
import { Article } from './types';

function makeArticles(count: number): Article[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `a${i}`,
    title: `Article ${i}`,
    link: `https://example.com/${i}`,
    pubDate: new Date().toISOString(),
  }));
}

describe('injectAds', () => {
  it('returns articles unchanged when count is less than 10', () => {
    const articles = makeArticles(9);
    const result = injectAds(articles);
    expect(result).toHaveLength(9);
    expect(result.every((item) => !('type' in item && item.type === 'ad'))).toBe(true);
  });

  it('inserts one ad after the 10th article', () => {
    const articles = makeArticles(10);
    const result = injectAds(articles);
    expect(result).toHaveLength(11);
    expect(result[10]).toEqual({ type: 'ad', id: 'ad-9' });
  });

  it('inserts two ads for 20 articles', () => {
    const articles = makeArticles(20);
    const result = injectAds(articles);
    expect(result).toHaveLength(22);
    expect(result[10]).toEqual({ type: 'ad', id: 'ad-9' });
    expect(result[21]).toEqual({ type: 'ad', id: 'ad-19' });
  });

  it('preserves article order', () => {
    const articles = makeArticles(12);
    const result = injectAds(articles);
    const articleItems = result.filter((item) => !('type' in item && item.type === 'ad'));
    expect(articleItems.map((a) => (a as Article).id)).toEqual(articles.map((a) => a.id));
  });

  it('returns empty array for empty input', () => {
    expect(injectAds([])).toEqual([]);
  });
});
