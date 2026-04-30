# Read/Unread Tracking + Desktop Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track which articles a user has read, show unread badges on column headers, and fire OS desktop notifications when keyword alert matches arrive while the app is backgrounded.

**Architecture:** Server-side SQLite table `read_articles` stores article IDs that have been read. A Zustand store mirrors this client-side for O(1) lookup. ArticleCard reads from the store to show visual read/unread state and marks an article read on click. Column header shows an unread count badge and a "mark all read" button. Column detects newly-arrived articles on each refresh and fires Web Notifications for keyword alert matches.

**Tech Stack:** Next.js 16 App Router, node:sqlite (DatabaseSync), Zustand, Lucide icons, Web Notifications API, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `lib/server/db.ts` | Modify | Add `read_articles` table to `initializeDatabase()` |
| `lib/server/read-articles-repository.ts` | Create | `markRead`, `markAllRead`, `getAllReadIds` |
| `app/api/articles/read/route.ts` | Create | GET (all IDs for hydration), POST (mark read / mark all) |
| `lib/read-articles-store.ts` | Create | Zustand store with `readIds: Set<string>`, `isRead`, `markRead`, `markAllRead`, `hydrateReadIds` |
| `components/StoreHydration.tsx` | Modify | Fetch GET `/api/articles/read` and call `hydrateReadIds` on mount |
| `components/deck/ArticleCard.tsx` | Modify | Read/unread dot + bold/dimmed styles; call `markRead` on click |
| `components/deck/Column.tsx` | Modify | Unread count badge, mark-all-read button, notification logic |
| `components/AppChrome.tsx` | Modify | Call `Notification.requestPermission()` on mount |
| `lib/server/read-articles-repository.test.ts` | Create | Vitest unit tests for repository functions |

---

## Task 1: Add `read_articles` table to DB

**Files:**
- Modify: `lib/server/db.ts` (inside `initializeDatabase()`, after the `feed_list_items` block)

- [ ] **Step 1: Add the table definition**

In `lib/server/db.ts`, inside the `db.exec(` template literal in `initializeDatabase()`, add this block after the `feed_list_items` table definition (before the `CREATE UNIQUE INDEX` lines):

```sql
    CREATE TABLE IF NOT EXISTS read_articles (
      article_id TEXT PRIMARY KEY,
      read_at    TEXT NOT NULL
    );
```

- [ ] **Step 2: Verify the app still starts**

```bash
cd /Users/fong/SynologyDrive/Jarvis/Projects/rssdeck
npm run dev
```

Expected: server starts on port 3000 with no errors. Stop it with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add lib/server/db.ts
git commit -m "feat: add read_articles table to SQLite schema"
```

---

## Task 2: Read articles repository

**Files:**
- Create: `lib/server/read-articles-repository.ts`
- Create: `lib/server/read-articles-repository.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/server/read-articles-repository.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock server-only so it doesn't throw in test env
vi.mock('server-only', () => ({}));

// Use in-memory SQLite for tests
vi.mock('./db', () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS read_articles (
      article_id TEXT PRIMARY KEY,
      read_at    TEXT NOT NULL
    );
  `);
  return { getDb: () => db };
});

import { markRead, markAllRead, getAllReadIds } from './read-articles-repository';

describe('read-articles-repository', () => {
  beforeEach(() => {
    const { getDb } = require('./db');
    getDb().exec('DELETE FROM read_articles');
  });

  describe('markRead', () => {
    it('stores an article id', () => {
      markRead('article-1');
      expect(getAllReadIds()).toContain('article-1');
    });

    it('is idempotent — calling twice does not throw', () => {
      markRead('article-1');
      expect(() => markRead('article-1')).not.toThrow();
    });
  });

  describe('markAllRead', () => {
    it('stores multiple article ids at once', () => {
      markAllRead(['article-2', 'article-3', 'article-4']);
      const ids = getAllReadIds();
      expect(ids).toContain('article-2');
      expect(ids).toContain('article-3');
      expect(ids).toContain('article-4');
    });

    it('does nothing for an empty array', () => {
      expect(() => markAllRead([])).not.toThrow();
      expect(getAllReadIds()).toHaveLength(0);
    });
  });

  describe('getAllReadIds', () => {
    it('returns empty array when nothing is read', () => {
      expect(getAllReadIds()).toEqual([]);
    });

    it('returns all stored ids', () => {
      markRead('a');
      markRead('b');
      const ids = getAllReadIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain('a');
      expect(ids).toContain('b');
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/fong/SynologyDrive/Jarvis/Projects/rssdeck
npx vitest run lib/server/read-articles-repository.test.ts
```

Expected: FAIL — `Cannot find module './read-articles-repository'`

- [ ] **Step 3: Create the repository**

Create `lib/server/read-articles-repository.ts`:

```typescript
import 'server-only';
import { getDb } from './db';

export function markRead(articleId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO read_articles (article_id, read_at)
    VALUES (?, ?)
  `).run(articleId, now);
}

export function markAllRead(articleIds: string[]): void {
  if (articleIds.length === 0) return;
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO read_articles (article_id, read_at)
    VALUES (?, ?)
  `);
  for (const id of articleIds) {
    stmt.run(id, now);
  }
}

export function getAllReadIds(): string[] {
  const db = getDb();
  return (db.prepare('SELECT article_id FROM read_articles').all() as { article_id: string }[])
    .map((row) => row.article_id);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/server/read-articles-repository.test.ts
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/server/read-articles-repository.ts lib/server/read-articles-repository.test.ts
git commit -m "feat: add read-articles repository with markRead, markAllRead, getAllReadIds"
```

---

## Task 3: API route `/api/articles/read`

**Files:**
- Create: `app/api/articles/read/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/articles/read/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAllReadIds, markRead, markAllRead } from '@/lib/server/read-articles-repository';

export async function GET() {
  return NextResponse.json({ readIds: getAllReadIds() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { articleId?: string; articleIds?: string[] };

    if (body.articleIds) {
      markAllRead(body.articleIds);
    } else if (body.articleId) {
      markRead(body.articleId);
    } else {
      return NextResponse.json({ error: 'Missing articleId or articleIds' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify the route responds**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/api/articles/read
```

Expected: `{"readIds":[]}`

```bash
curl -s -X POST http://localhost:3000/api/articles/read \
  -H "Content-Type: application/json" \
  -d '{"articleId":"test-123"}'
```

Expected: `{"ok":true}`

```bash
curl -s http://localhost:3000/api/articles/read
```

Expected: `{"readIds":["test-123"]}`

Stop dev server with `kill %1`.

- [ ] **Step 3: Commit**

```bash
git add app/api/articles/read/route.ts
git commit -m "feat: add GET/POST /api/articles/read route"
```

---

## Task 4: Client-side Zustand store

**Files:**
- Create: `lib/read-articles-store.ts`

- [ ] **Step 1: Create the store**

Create `lib/read-articles-store.ts`:

```typescript
import { create } from 'zustand';

interface ReadArticlesState {
  readIds: Set<string>;
  hydrateReadIds: (ids: string[]) => void;
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  isRead: (id: string) => boolean;
}

function persistMarkRead(articleId: string) {
  if (typeof window === 'undefined') return;
  void fetch('/api/articles/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleId }),
  }).catch((err) => {
    console.error('Failed to persist read state:', err);
  });
}

function persistMarkAllRead(articleIds: string[]) {
  if (typeof window === 'undefined') return;
  void fetch('/api/articles/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleIds }),
  }).catch((err) => {
    console.error('Failed to persist read state:', err);
  });
}

export const useReadArticlesStore = create<ReadArticlesState>()((set, get) => ({
  readIds: new Set<string>(),

  hydrateReadIds: (ids) => set({ readIds: new Set(ids) }),

  markRead: (id) => {
    if (get().readIds.has(id)) return;
    persistMarkRead(id);
    set((state) => ({ readIds: new Set([...state.readIds, id]) }));
  },

  markAllRead: (ids) => {
    const unread = ids.filter((id) => !get().readIds.has(id));
    if (unread.length === 0) return;
    persistMarkAllRead(unread);
    set((state) => ({ readIds: new Set([...state.readIds, ...unread]) }));
  },

  isRead: (id) => get().readIds.has(id),
}));
```

- [ ] **Step 2: Commit**

```bash
git add lib/read-articles-store.ts
git commit -m "feat: add read-articles Zustand store"
```

---

## Task 5: Hydrate read state on app load

**Files:**
- Modify: `components/StoreHydration.tsx`

- [ ] **Step 1: Add read IDs to the hydration fetch**

In `components/StoreHydration.tsx`:

1. Add import at top (after the `useBookmarksStore` import):
```typescript
import { useReadArticlesStore } from '@/lib/read-articles-store';
```

2. Add inside the `StoreHydration` function body (after the `hydrateBookmarks` line):
```typescript
const hydrateReadIds = useReadArticlesStore((state) => state.hydrateReadIds);
```

3. Update the `Promise.all` call to include the read IDs fetch:
```typescript
const [deckState, settingsResponse, bookmarksResponse, readIdsResponse] = await Promise.all([
  fetchDeckState(),
  fetch('/api/settings', { cache: 'no-store' }),
  fetch('/api/bookmarks', { cache: 'no-store' }),
  fetch('/api/articles/read', { cache: 'no-store' }),
]);

const settings = await settingsResponse.json();
const bookmarks = await bookmarksResponse.json();
const readIdsData = await readIdsResponse.json() as { readIds: string[] };
```

4. Add after `hydrateBookmarks(bookmarks)`:
```typescript
hydrateReadIds(readIdsData.readIds);
```

5. Add `hydrateReadIds` to the `useEffect` dependency array:
```typescript
}, [hydrateBookmarks, hydrateReadIds, hydrateSettings, setColumns, setSavedFeeds]);
```

- [ ] **Step 2: Verify app loads without errors**

```bash
npm run dev
```

Open http://localhost:3000 in a browser. Expected: app loads normally, no console errors.

- [ ] **Step 3: Commit**

```bash
git add components/StoreHydration.tsx
git commit -m "feat: hydrate read article IDs from server on app load"
```

---

## Task 6: ArticleCard — read/unread visual treatment

**Files:**
- Modify: `components/deck/ArticleCard.tsx`

- [ ] **Step 1: Add read state to ArticleCard**

In `components/deck/ArticleCard.tsx`:

1. Add import after `useBookmarksStore` import:
```typescript
import { useReadArticlesStore } from '@/lib/read-articles-store';
```

2. Inside the `ArticleCard` function, after the `bookmarked` line:
```typescript
const { isRead, markRead } = useReadArticlesStore();
const read = isRead(article.id);
```

3. Update the `onClick` on the outer `<button>` from:
```typescript
onClick={() => onClick(article)}
```
to:
```typescript
onClick={() => {
  markRead(article.id);
  onClick(article);
}}
```

4. Inside the `<div className="flex items-start gap-2">` wrapper (the one that contains the `<h3>` title), add an unread dot as the first child — before the `<h3>`:
```tsx
{!read && (
  <span className="mt-1.5 w-2 h-2 rounded-full bg-accent flex-shrink-0" />
)}
```

5. Update the `<h3>` className to reflect read state. Replace the existing `className` prop:
```tsx
className={cn(
  'transition-colors line-clamp-2 flex-1',
  read ? 'font-normal text-foreground-secondary' : 'font-medium',
  !matchedAlert && !read && 'text-foreground group-hover:text-accent',
  !matchedAlert && read && 'text-foreground-secondary',
  viewMode === 'compact' ? 'text-sm' : 'text-base'
)}
```

6. Update the outer `<button>` className to add opacity when read. Change:
```typescript
'w-full text-left p-3 border-b border-border hover:bg-background-tertiary transition-colors group relative article-card',
```
to:
```typescript
'w-full text-left p-3 border-b border-border hover:bg-background-tertiary transition-colors group relative article-card',
read && 'opacity-50 hover:opacity-100',
```
(pass both strings to `cn()`)

- [ ] **Step 2: Verify visually**

```bash
npm run dev
```

Open http://localhost:3000. Click any article — it should dim (opacity-50) and the dot should disappear. Unclicked articles should show the accent dot and bold title.

- [ ] **Step 3: Commit**

```bash
git add components/deck/ArticleCard.tsx
git commit -m "feat: show unread dot and bold title on ArticleCard, mark read on click"
```

---

## Task 7: Column — unread badge + mark all read + notifications

**Files:**
- Modify: `components/deck/Column.tsx`

- [ ] **Step 1: Add imports**

In `components/deck/Column.tsx`, add to the existing import block:

```typescript
import { CheckCheck } from 'lucide-react';
import { useReadArticlesStore } from '@/lib/read-articles-store';
import { useSettingsStore } from '@/lib/settings-store';
```

Note: `useSettingsStore` may already be imported — check first and only add if missing.

- [ ] **Step 2: Add store selectors and unread count inside the Column function**

Inside `Column` function body, after the existing `const articleAgeFilter` line:

```typescript
const { isRead, markAllRead } = useReadArticlesStore();
const keywordAlerts = useSettingsStore((state) => state.keywordAlerts);
const unreadCount = articles.filter((a) => !isRead(a.id)).length;
```

- [ ] **Step 3: Add prevArticleIdsRef for notification tracking**

After the existing `const resizedWidthRef` line:

```typescript
const prevArticleIdsRef = useRef<Set<string> | null>(null);
```

- [ ] **Step 4: Fire notifications for new keyword-matching articles**

Replace the two `setArticles(uniqueArticles)` calls (they appear twice in `fetchFeeds` — once for list/search columns, once for legacy columns) by wrapping each with the notification logic.

Create a helper inside the `Column` function, before `fetchFeeds`:

```typescript
const handleNewArticles = useCallback((next: Article[]) => {
  const prev = prevArticleIdsRef.current;

  if (prev !== null && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const newArticles = next.filter((a) => !prev.has(a.id));
    const enabledAlerts = keywordAlerts.filter((a) => a.enabled);

    for (const article of newArticles) {
      const matchedAlert = enabledAlerts.find((a) => {
        const escaped = a.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, 'i').test(article.title);
      });
      if (matchedAlert && document.visibilityState === 'hidden') {
        new Notification(`🔔 ${matchedAlert.keyword}`, {
          body: article.title,
          icon: '/icon.png',
        });
      }
    }
  }

  prevArticleIdsRef.current = new Set(next.map((a) => a.id));
  setArticles(next);
  setColumnArticles(column.id, next);
}, [column.id, keywordAlerts, setColumnArticles]);
```

Then in `fetchFeeds`, replace both occurrences of:
```typescript
setArticles(uniqueArticles);
setColumnArticles(column.id, uniqueArticles);
```
with:
```typescript
handleNewArticles(uniqueArticles);
```

Also remove the duplicate `setColumnArticles` calls that follow — `handleNewArticles` handles both.

- [ ] **Step 5: Add `handleNewArticles` to `fetchFeeds` dependency array**

The `fetchFeeds` useCallback dependency array is at the bottom of the function. Add `handleNewArticles`:

```typescript
}, [column.type, column.id, column.sources, handleNewArticles]);
```

Remove `setColumnArticles` from this array since it's now used inside `handleNewArticles`.

- [ ] **Step 6: Add the unread badge and mark-all-read button to the column header**

In the column header JSX, find the `<div className="flex items-center gap-1">` that contains the Refresh, Settings, and Remove buttons. Add before the refresh button:

```tsx
{unreadCount > 0 && (
  <>
    <span className="text-[10px] font-bold bg-accent text-white px-1.5 py-0.5 rounded-full leading-none">
      {unreadCount}
    </span>
    <button
      onClick={() => markAllRead(articles.map((a) => a.id))}
      className="p-1.5 hover:bg-background-secondary rounded transition-colors text-foreground-secondary hover:text-accent"
      title="Mark all as read"
    >
      <CheckCheck className="w-4 h-4" />
    </button>
  </>
)}
```

- [ ] **Step 7: Verify visually**

```bash
npm run dev
```

Open http://localhost:3000. Expected:
- Each column header shows a purple badge with the unread article count
- A `CheckCheck` button appears next to the badge — clicking it dims all articles in the column to read state and the badge disappears
- (Notifications require a keyword alert to be set and the window to be in the background — can be tested manually)

- [ ] **Step 8: Commit**

```bash
git add components/deck/Column.tsx
git commit -m "feat: add unread badge, mark-all-read button, and keyword alert notifications to Column"
```

---

## Task 8: Request notification permission in AppChrome

**Files:**
- Modify: `components/AppChrome.tsx`

- [ ] **Step 1: Add permission request on mount**

In `components/AppChrome.tsx`:

1. Change `import { useState } from 'react';` to:
```typescript
import { useState, useEffect } from 'react';
```

2. Inside the `AppChrome` function body, after the existing `useState` declarations:
```typescript
useEffect(() => {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    const t = setTimeout(() => void Notification.requestPermission(), 500);
    return () => clearTimeout(t);
  }
}, []);
```

- [ ] **Step 2: Verify permission prompt appears once**

```bash
npm run dev
```

Open http://localhost:3000. Expected: browser/Electron shows a notification permission prompt on first load. On subsequent loads it should not appear again.

- [ ] **Step 3: Commit**

```bash
git add components/AppChrome.tsx
git commit -m "feat: request notification permission on app load"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
cd /Users/fong/SynologyDrive/Jarvis/Projects/rssdeck
npm test
```

Expected: all tests pass, including the new `read-articles-repository` tests.

- [ ] **Step 2: End-to-end smoke test**

1. Start the app: `npm run dev`
2. Open http://localhost:3000
3. Verify: all articles show accent dot (unread) and column headers show unread counts
4. Click an article — it should dim and its dot should disappear; unread count badge decrements
5. Click "Mark all read" (CheckCheck icon) in a column header — all articles dim, badge disappears
6. Refresh the page — read state persists (fetched from server on hydration)
7. In Settings, add a keyword alert. Wait for a column to auto-refresh. If a matching article arrives while the window is hidden, an OS notification fires.

- [ ] **Step 3: Push to remote**

```bash
git push origin HEAD:main
```
