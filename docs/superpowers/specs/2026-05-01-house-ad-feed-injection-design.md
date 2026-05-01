# House Ad Feed Injection — Design Spec

**Date:** 2026-05-01  
**Status:** Approved

## Summary

Insert a "Buy Me a Coffee" house ad card into each feed column every 10th article. The app remains free to download; this gives users a low-friction way to support development while keeping the experience native and non-intrusive.

## Goals

- Monetise the free macOS Electron app via voluntary support
- Ad card feels native alongside `ArticleCard` (not a banner, not a popup)
- Zero external ad network dependency — fully self-contained

## Non-Goals

- External ad networks (AdSense, Carbon, EthicalAds)
- Configurable ad frequency per user
- Analytics/impression tracking

## Architecture

**Approach:** Inject a typed ad sentinel into the articles array before rendering. The `Column` component maps over a `FeedItem[]` union type and renders either `ArticleCard` or `AdCard` based on the item type.

## Data Types

Add to `lib/types.ts`:

```ts
export type AdSentinel = { type: 'ad'; id: string };
export type FeedItem = Article | AdSentinel;
```

## New Component: `components/deck/AdCard.tsx`

- Matches `ArticleCard` card styling: same border, padding, border-radius, dark/light theme support
- Lucide `Coffee` icon
- Text: "Like IntelliDeck? Buy Fong a coffee."
- Small "Support" label (top-right corner) to be transparent about what it is
- CTA button/link that opens `https://buymeacoffee.com/kianfongl` via `window.open` with `_blank` target (Electron-safe external link)

## Column.tsx Changes

Add a pure helper function:

```ts
function injectAds(articles: Article[]): FeedItem[] {
  const result: FeedItem[] = [];
  articles.forEach((article, i) => {
    result.push(article);
    if ((i + 1) % 10 === 0) {
      result.push({ type: 'ad', id: `ad-${i}` });
    }
  });
  return result;
}
```

Call `injectAds` on the final filtered/deduplicated articles array before mapping to JSX. The `.map()` branches on `item.type === 'ad'` to render `AdCard`, otherwise `ArticleCard`.

## Behaviour & Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Column has < 10 articles | No ad shown |
| Column has exactly 10 articles | One ad after the 10th |
| Articles refresh | Ads re-inject based on new array; no flicker (index-based, not random) |
| User clicks ad | External link opens in default browser; feed unaffected |

## Files Changed

| File | Change |
|------|--------|
| `lib/types.ts` | Add `AdSentinel` and `FeedItem` types |
| `components/deck/AdCard.tsx` | New component |
| `components/deck/Column.tsx` | Add `injectAds` helper, update render loop |
