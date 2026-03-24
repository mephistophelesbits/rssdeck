# Feed Lists & Search Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add named feed lists (reusable collections of RSS URLs) and search columns (auto-refreshing from the articles DB via saved search rules) to the RSS deck, without touching existing columns.

**Architecture:** Additive — two new DB tables (`feed_lists`, `feed_list_items`), two nullable columns on `columns_state`, two new `Column` type values (`'list'`, `'search'`), a new Feed List Manager page at `/lists`, and a revamped Add Column modal. Existing legacy columns are untouched.

**Tech Stack:** Next.js 15 App Router, TypeScript, node:sqlite (DatabaseSync), React 19, Zustand, Tailwind CSS, nanoid, lucide-react

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/types.ts` | Modify | Add `FeedList`, `FeedListWithItems` types; extend `Column` with `feedListId`, `searchRuleId`, new type values |
| `lib/server/db.ts` | Modify | Add `feed_lists`, `feed_list_items` DDL; add two `ensureColumn` calls on `columns_state` |
| `lib/server/feed-lists-repository.ts` | Create | All feed list CRUD functions |
| `app/api/lists/route.ts` | Create | GET (list all), POST (create) |
| `app/api/lists/[listId]/route.ts` | Create | GET (detail), PATCH (rename), DELETE (blocked if in use) |
| `app/api/lists/[listId]/feeds/route.ts` | Create | POST (add feed to list) |
| `app/api/lists/[listId]/feeds/[feedId]/route.ts` | Create | DELETE (remove feed from list) |
| `app/api/lists/[listId]/feeds/reorder/route.ts` | Create | POST (reorder feeds) |
| `app/api/deck/columns/[columnId]/articles/route.ts` | Create | GET articles for search columns |
| `lib/server/deck-repository.ts` | Modify | `ColumnRow`, `createColumn`, `updateColumn`, `getColumns` — add `feed_list_id`, `search_rule_id` |
| `components/deck/Column.tsx` | Modify | `fetchFeeds` — handle `'list'` and `'search'` column types |
| `components/ui/TopNavBar.tsx` | Modify | Add `/lists` nav item |
| `lib/i18n/en.json` | Modify | Add `nav.lists` + `lists.*` strings |
| `lib/i18n/zh-CN.json` | Modify | Add Chinese translations |
| `app/lists/page.tsx` | Create | Feed List Manager page (server shell) |
| `components/ui/FeedListManager.tsx` | Create | Two-panel client component |
| `components/ui/AddFeedModal.tsx` | Modify | Replace URL/Categories tabs with "From List" and "Search Rule" tabs; keep OPML tab |

---

## Task 1: DB Schema + TypeScript Types

**Files:**
- Modify: `lib/server/db.ts`
- Modify: `lib/types.ts`

### Steps

- [ ] **Step 1: Add DDL for `feed_lists` and `feed_list_items` inside `initializeDatabase()`**

In `lib/server/db.ts`, add inside the `db.exec(...)` block in `initializeDatabase()`, after the last `CREATE TABLE IF NOT EXISTS` block (before the `CREATE UNIQUE INDEX` lines at the bottom), add:

```sql
    CREATE TABLE IF NOT EXISTS feed_lists (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feed_list_items (
      id         TEXT PRIMARY KEY,
      list_id    TEXT NOT NULL REFERENCES feed_lists(id) ON DELETE CASCADE,
      feed_id    TEXT NOT NULL REFERENCES saved_feeds(id) ON DELETE CASCADE,
      position   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_list_items_list_feed
      ON feed_list_items(list_id, feed_id);

    CREATE INDEX IF NOT EXISTS idx_feed_list_items_list_id
      ON feed_list_items(list_id, position);
```

- [ ] **Step 2: Add `ensureColumn` calls for `columns_state`**

In `lib/server/db.ts`, after the existing `ensureColumn` calls at the end of `initializeDatabase()` (currently lines 205–207), add:

```ts
  ensureColumn(db, 'columns_state', 'feed_list_id', 'TEXT');
  ensureColumn(db, 'columns_state', 'search_rule_id', 'TEXT');
```

- [ ] **Step 3: Extend `Column` type and add `FeedList` interfaces in `lib/types.ts`**

Change line 33 from:
```ts
  type: 'single-feed' | 'category' | 'unified';
```
to:
```ts
  type: 'single-feed' | 'category' | 'unified' | 'list' | 'search';
  feedListId?: string;
  searchRuleId?: string;
```

Then append at the bottom of `lib/types.ts`:

```ts
export interface FeedList {
  id: string;
  name: string;
  feedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeedListWithItems extends FeedList {
  items: Array<FeedSource & { feedListItemId: string; position: number }>;
}

// Client-safe shape of a saved search rule. Mirrors SavedSearchRule from
// search-repository without importing the server-only module in client components.
export interface SearchRule {
  id: string;
  name: string;
  query: string;
  keywords: string[];
  lastRunAt: string | null;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/fong/SynologyDrive/Jarvis/Projects/rssdeck && npx tsc --noEmit
```

Expected: no errors (any existing errors will be pre-existing)

- [ ] **Step 5: Commit**

```bash
git add lib/server/db.ts lib/types.ts
git commit -m "feat: add feed_lists/feed_list_items tables and extend Column type"
```

---

## Task 2: Feed List Repository

**Files:**
- Create: `lib/server/feed-lists-repository.ts`

### Steps

- [ ] **Step 1: Create the repository file**

```ts
import 'server-only';

import { nanoid } from 'nanoid';
import { getDb } from './db';
import { FeedList, FeedListWithItems, FeedSource } from '@/lib/types';

type FeedListRow = {
  id: string;
  name: string;
  feed_count: number;
  created_at: string;
  updated_at: string;
};

type FeedListItemRow = {
  feed_list_item_id: string;
  position: number;
  feed_id: string;
  url: string;
  title: string;
  site_url: string | null;
  last_fetched_at: string | null;
  last_error: string | null;
};

export function getFeedLists(): FeedList[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT fl.id, fl.name, fl.created_at, fl.updated_at,
           COUNT(fli.id) AS feed_count
    FROM feed_lists fl
    LEFT JOIN feed_list_items fli ON fli.list_id = fl.id
    GROUP BY fl.id
    ORDER BY fl.name ASC
  `).all() as FeedListRow[];

  return rows.map(rowToFeedList);
}

export function getFeedListById(listId: string): FeedListWithItems | null {
  const db = getDb();
  const listRow = db.prepare(`
    SELECT fl.id, fl.name, fl.created_at, fl.updated_at,
           COUNT(fli.id) AS feed_count
    FROM feed_lists fl
    LEFT JOIN feed_list_items fli ON fli.list_id = fl.id
    WHERE fl.id = ?
    GROUP BY fl.id
  `).get(listId) as FeedListRow | undefined;

  if (!listRow) return null;

  const itemRows = db.prepare(`
    SELECT fli.id AS feed_list_item_id, fli.position,
           sf.id AS feed_id, sf.url, sf.title, sf.site_url,
           sf.last_fetched_at, sf.last_error
    FROM feed_list_items fli
    JOIN saved_feeds sf ON sf.id = fli.feed_id
    WHERE fli.list_id = ?
    ORDER BY fli.position ASC, fli.created_at ASC
  `).all(listId) as FeedListItemRow[];

  return {
    ...rowToFeedList(listRow),
    items: itemRows.map((row) => ({
      id: row.feed_id,
      url: row.url,
      title: row.title,
      siteUrl: row.site_url ?? undefined,
      lastFetchedAt: row.last_fetched_at ?? undefined,
      lastError: row.last_error ?? undefined,
      feedListItemId: row.feed_list_item_id,
      position: row.position,
    })),
  };
}

export function createFeedList(name: string): FeedList {
  const db = getDb();
  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO feed_lists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run(id, name.trim(), now, now);
  return getFeedLists().find((l) => l.id === id)!;
}

export function renameFeedList(listId: string, name: string): FeedList {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE feed_lists SET name = ?, updated_at = ? WHERE id = ?`)
    .run(name.trim(), now, listId);
  const list = getFeedLists().find((l) => l.id === listId);
  if (!list) throw new Error('List not found');
  return list;
}

export function deleteFeedList(listId: string): void {
  const inUse = getColumnsUsingList(listId);
  if (inUse > 0) {
    throw Object.assign(new Error(`List is used by ${inUse} column(s)`), { code: 'IN_USE', count: inUse });
  }
  const db = getDb();
  db.prepare(`DELETE FROM feed_lists WHERE id = ?`).run(listId);
}

export function addFeedToList(listId: string, feed: FeedSource): { feedListItemId: string; position: number } & FeedSource {
  const db = getDb();
  const now = new Date().toISOString();

  // Upsert the feed into saved_feeds first (reuse existing pattern)
  db.prepare(`
    INSERT INTO saved_feeds (id, url, title, site_url, last_fetched_at, last_error, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      title = excluded.title,
      site_url = COALESCE(excluded.site_url, saved_feeds.site_url),
      updated_at = excluded.updated_at
  `).run(feed.id, feed.url, feed.title, feed.siteUrl ?? null, feed.lastFetchedAt ?? null, feed.lastError ?? null, now, now);

  // Get the canonical feed id (in case conflict resolved to existing row)
  const savedFeed = db.prepare(`SELECT id FROM saved_feeds WHERE url = ?`).get(feed.url) as { id: string };

  // Get next position
  const maxPos = db.prepare(`SELECT COALESCE(MAX(position), -1) AS m FROM feed_list_items WHERE list_id = ?`).get(listId) as { m: number };
  const position = maxPos.m + 1;

  const itemId = nanoid();
  db.prepare(`
    INSERT INTO feed_list_items (id, list_id, feed_id, position, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(list_id, feed_id) DO NOTHING
  `).run(itemId, listId, savedFeed.id, position, now);

  // Return actual row (may differ if conflict resolved to existing)
  const row = db.prepare(`
    SELECT fli.id AS feed_list_item_id, fli.position,
           sf.id AS feed_id, sf.url, sf.title, sf.site_url,
           sf.last_fetched_at, sf.last_error
    FROM feed_list_items fli
    JOIN saved_feeds sf ON sf.id = fli.feed_id
    WHERE fli.list_id = ? AND sf.url = ?
  `).get(listId, feed.url) as FeedListItemRow;

  return {
    id: row.feed_id,
    url: row.url,
    title: row.title,
    siteUrl: row.site_url ?? undefined,
    lastFetchedAt: row.last_fetched_at ?? undefined,
    lastError: row.last_error ?? undefined,
    feedListItemId: row.feed_list_item_id,
    position: row.position,
  };
}

export function removeFeedFromList(listId: string, feedId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM feed_list_items WHERE list_id = ? AND feed_id = ?`).run(listId, feedId);
}

export function reorderFeedListItems(listId: string, orderedFeedIds: string[]): void {
  const db = getDb();
  const update = db.prepare(`UPDATE feed_list_items SET position = ? WHERE list_id = ? AND feed_id = ?`);
  orderedFeedIds.forEach((feedId, index) => {
    update.run(index, listId, feedId);
  });
}

export function getColumnsUsingList(listId: string): number {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) AS count FROM columns_state WHERE feed_list_id = ?`).get(listId) as { count: number };
  return row.count;
}

function rowToFeedList(row: FeedListRow): FeedList {
  return {
    id: row.id,
    name: row.name,
    feedCount: row.feed_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/fong/SynologyDrive/Jarvis/Projects/rssdeck && npx tsc --noEmit
```

Expected: no type errors in the new file

- [ ] **Step 3: Commit**

```bash
git add lib/server/feed-lists-repository.ts
git commit -m "feat: add feed-lists-repository with full CRUD"
```

---

## Task 3: Feed List API Routes

**Files:**
- Create: `app/api/lists/route.ts`
- Create: `app/api/lists/[listId]/route.ts`
- Create: `app/api/lists/[listId]/feeds/route.ts`
- Create: `app/api/lists/[listId]/feeds/[feedId]/route.ts`
- Create: `app/api/lists/[listId]/feeds/reorder/route.ts`

### Steps

- [ ] **Step 1: Create `app/api/lists/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createFeedList, getFeedLists } from '@/lib/server/feed-lists-repository';

export async function GET() {
  return NextResponse.json(getFeedLists());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { name?: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 });
    }
    return NextResponse.json(createFeedList(body.name), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create list' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Create `app/api/lists/[listId]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import {
  deleteFeedList,
  getFeedListById,
  renameFeedList,
} from '@/lib/server/feed-lists-repository';

type Params = { params: Promise<{ listId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { listId } = await params;
  const list = getFeedListById(listId);
  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(list);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { listId } = await params;
  try {
    const body = await request.json() as { name?: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 });
    }
    return NextResponse.json(renameFeedList(listId, body.name));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rename list' },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { listId } = await params;
  try {
    deleteFeedList(listId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException & { code?: string }).code === 'IN_USE') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete list' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Create `app/api/lists/[listId]/feeds/route.ts`**

This validates the URL via the existing `/api/rss` endpoint before adding to the list.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { addFeedToList } from '@/lib/server/feed-lists-repository';
import { generateId } from '@/lib/utils';

type Params = { params: Promise<{ listId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { listId } = await params;
  try {
    const body = await request.json() as { url?: string };
    if (!body.url?.trim()) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    // Validate and fetch feed metadata
    const rssRes = await fetch(
      `${request.nextUrl.origin}/api/rss?url=${encodeURIComponent(body.url)}`,
    );
    if (!rssRes.ok) {
      return NextResponse.json({ error: 'Invalid feed URL or unreachable feed' }, { status: 400 });
    }
    const rssData = await rssRes.json() as { title?: string; link?: string };

    const feed = {
      id: generateId(),
      url: body.url.trim(),
      title: rssData.title ?? body.url.trim(),
      siteUrl: rssData.link ?? undefined,
    };

    const item = addFeedToList(listId, feed);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add feed' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Create `app/api/lists/[listId]/feeds/[feedId]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { removeFeedFromList } from '@/lib/server/feed-lists-repository';

type Params = { params: Promise<{ listId: string; feedId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { listId, feedId } = await params;
  try {
    removeFeedFromList(listId, feedId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove feed' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 5: Create `app/api/lists/[listId]/feeds/reorder/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { reorderFeedListItems } from '@/lib/server/feed-lists-repository';

type Params = { params: Promise<{ listId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { listId } = await params;
  try {
    const body = await request.json() as { orderedFeedIds?: string[] };
    if (!Array.isArray(body.orderedFeedIds)) {
      return NextResponse.json({ error: 'Missing orderedFeedIds array' }, { status: 400 });
    }
    reorderFeedListItems(listId, body.orderedFeedIds);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reorder feeds' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/fong/SynologyDrive/Jarvis/Projects/rssdeck && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add app/api/lists/
git commit -m "feat: add feed list CRUD API routes"
```

---

## Task 4: deck-repository Updates + Search Column Articles Endpoint

**Files:**
- Modify: `lib/server/deck-repository.ts`
- Create: `app/api/deck/columns/[columnId]/articles/route.ts`

### Steps

- [ ] **Step 1: Update `ColumnRow` type in `deck-repository.ts`**

In `lib/server/deck-repository.ts`, change the `ColumnRow` type (lines 7–16) to add two new fields:

```ts
type ColumnRow = {
  id: string;
  title: string;
  type: Column['type'];
  width: number;
  position: number;
  refresh_interval: number;
  view_mode: Column['settings']['viewMode'];
  sources_json: string;
  feed_list_id: string | null;
  search_rule_id: string | null;
};
```

- [ ] **Step 2: Update `createColumn()` INSERT**

Change the INSERT statement (lines 41–56). The new INSERT must include `feed_list_id` and `search_rule_id`:

```ts
  db.prepare(`
    INSERT INTO columns_state (
      id, title, type, width, position, refresh_interval, view_mode, sources_json,
      feed_list_id, search_rule_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    column.id,
    column.title,
    column.type,
    column.width,
    position,
    column.settings.refreshInterval,
    column.settings.viewMode,
    JSON.stringify(column.sources),
    column.feedListId ?? null,
    column.searchRuleId ?? null,
    now,
    now
  );
```

- [ ] **Step 3: Update `updateColumn()` UPDATE SET**

Change the UPDATE statement (lines 82–95). Replace the SET clause to include `feed_list_id` and `search_rule_id`:

```ts
  db.prepare(`
    UPDATE columns_state
    SET title = ?, type = ?, width = ?, refresh_interval = ?, view_mode = ?,
        sources_json = ?, feed_list_id = ?, search_rule_id = ?, updated_at = ?
    WHERE id = ?
  `).run(
    nextColumn.title,
    nextColumn.type,
    nextColumn.width,
    nextColumn.settings.refreshInterval,
    nextColumn.settings.viewMode,
    JSON.stringify(nextColumn.sources),
    nextColumn.feedListId ?? null,
    nextColumn.searchRuleId ?? null,
    now,
    columnId
  );
```

- [ ] **Step 4: Update `getColumns()` SELECT and mapping**

In the `getColumns()` function (lines 203–222), add `feed_list_id, search_rule_id` to the SELECT and map them:

```ts
function getColumns() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, title, type, width, position, refresh_interval, view_mode, sources_json,
           feed_list_id, search_rule_id
    FROM columns_state
    ORDER BY position ASC, created_at ASC
  `).all() as ColumnRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    width: row.width,
    sources: JSON.parse(row.sources_json) as FeedSource[],
    settings: {
      refreshInterval: row.refresh_interval,
      viewMode: row.view_mode,
    },
    feedListId: row.feed_list_id ?? undefined,
    searchRuleId: row.search_rule_id ?? undefined,
  }));
}
```

- [ ] **Step 5: Create `app/api/deck/columns/[columnId]/articles/route.ts`**

This endpoint serves articles for `'search'` columns by querying the articles DB:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDeckState } from '@/lib/server/deck-repository';
import { getSearchRules, runArticleSearch } from '@/lib/server/search-repository';

type Params = { params: Promise<{ columnId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { columnId } = await params;
  const { columns } = getDeckState();
  const column = columns.find((c) => c.id === columnId);

  if (!column) {
    return NextResponse.json({ error: 'Column not found' }, { status: 404 });
  }

  if (column.type !== 'search' || !column.searchRuleId) {
    return NextResponse.json({ error: 'Not a search column' }, { status: 400 });
  }

  const rules = getSearchRules();
  const rule = rules.find((r) => r.id === column.searchRuleId);
  if (!rule) {
    return NextResponse.json({ error: 'Search rule was deleted' }, { status: 404 });
  }

  const { results } = runArticleSearch(rule.query);
  return NextResponse.json(results);
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/fong/SynologyDrive/Jarvis/Projects/rssdeck && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add lib/server/deck-repository.ts app/api/deck/columns/
git commit -m "feat: extend deck-repository with feedListId/searchRuleId and add search column articles endpoint"
```

---

## Task 5: Feed List Manager Page, Nav, and i18n

**Files:**
- Create: `app/lists/page.tsx`
- Create: `components/ui/FeedListManager.tsx`
- Modify: `components/ui/TopNavBar.tsx`
- Modify: `lib/i18n/en.json`
- Modify: `lib/i18n/zh-CN.json`

### Steps

- [ ] **Step 1: Add i18n strings to `lib/i18n/en.json`**

In the `"nav"` object, add `"lists": "Feed Lists"`.

Add a new top-level `"lists"` section:

```json
  "lists": {
    "title": "Feed Lists",
    "description": "Manage named collections of RSS feed sources.",
    "myLists": "My Lists",
    "newList": "+ New",
    "noListSelected": "Select a list from the left panel",
    "noLists": "No lists yet. Click \"+ New\" to create one.",
    "pasteFeedUrl": "Paste feed URL…",
    "addFeed": "+ Add",
    "deleteList": "Delete list",
    "usedByColumns": "Used by {count} columns",
    "useInNewColumn": "Use in New Column →",
    "listNamePlaceholder": "List name…",
    "save": "Save",
    "create": "Create",
    "cancel": "✕",
    "feedCount": "{count} feeds",
    "deletedListError": "Source list was deleted",
    "addingFeed": "Adding…",
    "feedAlreadyInList": "Feed already in list",
    "invalidFeedUrl": "Invalid feed URL"
  }
```

- [ ] **Step 2: Add i18n strings to `lib/i18n/zh-CN.json`**

Add `"lists": "订阅列表"` to the `"nav"` section.

Add equivalent `"lists"` section:

```json
  "lists": {
    "title": "订阅列表",
    "description": "管理 RSS 订阅源集合。",
    "myLists": "我的列表",
    "newList": "+ 新建",
    "noListSelected": "从左侧面板选择一个列表",
    "noLists": "暂无列表，点击"+ 新建"创建。",
    "pasteFeedUrl": "粘贴订阅地址…",
    "addFeed": "+ 添加",
    "deleteList": "删除列表",
    "usedByColumns": "被 {count} 个栏目使用",
    "useInNewColumn": "在新栏目中使用 →",
    "listNamePlaceholder": "列表名称…",
    "save": "保存",
    "create": "创建",
    "cancel": "✕",
    "feedCount": "{count} 个订阅",
    "deletedListError": "订阅列表已删除",
    "addingFeed": "添加中…",
    "feedAlreadyInList": "订阅已在列表中",
    "invalidFeedUrl": "无效的订阅地址"
  }
```

- [ ] **Step 3: Add `/lists` to `TopNavBar.tsx` nav items and prefetch**

In `components/ui/TopNavBar.tsx`:

1. Add `List` to the lucide-react import on line 6:
   ```ts
   import { Rss, LayoutDashboard, Newspaper, Search, Bookmark, Moon, Sun, List } from 'lucide-react';
   ```

2. Add a new entry to `NAV_ITEMS` (after the Search entry):
   ```ts
   { href: '/lists', labelKey: 'nav.lists', icon: List },
   ```

3. In the `useEffect` prefetch block (lines 33–40), add:
   ```ts
   router.prefetch('/lists');
   ```

- [ ] **Step 4: Create `components/ui/FeedListManager.tsx`**

This is the main two-panel client component. It uses React state for optimistic UI and calls the `/api/lists/` endpoints.

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, GripVertical, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import type { FeedList, FeedListWithItems } from '@/lib/types';

export function FeedListManager() {
  const { t } = useTranslation();
  const [lists, setLists] = useState<FeedList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<FeedListWithItems | null>(null);
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // New list creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isSavingNew, setIsSavingNew] = useState(false);

  // Rename state
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);

  // Add feed state
  const [feedUrl, setFeedUrl] = useState('');
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [addFeedError, setAddFeedError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    const res = await fetch('/api/lists');
    if (res.ok) {
      const data: FeedList[] = await res.json();
      setLists(data);
    }
    setIsLoadingLists(false);
  }, []);

  const loadListDetail = useCallback(async (listId: string) => {
    setIsLoadingDetail(true);
    const res = await fetch(`/api/lists/${listId}`);
    if (res.ok) {
      setSelectedList(await res.json());
    }
    setIsLoadingDetail(false);
  }, []);

  useEffect(() => { void loadLists(); }, [loadLists]);

  useEffect(() => {
    if (selectedListId) void loadListDetail(selectedListId);
    else setSelectedList(null);
  }, [selectedListId, loadListDetail]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setIsSavingNew(true);
    const res = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newListName }),
    });
    if (res.ok) {
      const created: FeedList = await res.json();
      setIsCreating(false);
      setNewListName('');
      await loadLists();
      setSelectedListId(created.id);
    }
    setIsSavingNew(false);
  };

  const handleRename = async (listId: string) => {
    if (!renameValue.trim()) return;
    setIsSavingRename(true);
    const res = await fetch(`/api/lists/${listId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue }),
    });
    if (res.ok) {
      setRenamingListId(null);
      await loadLists();
      if (selectedListId === listId) await loadListDetail(listId);
    }
    setIsSavingRename(false);
  };

  const handleDeleteList = async () => {
    if (!selectedListId) return;
    const res = await fetch(`/api/lists/${selectedListId}`, { method: 'DELETE' });
    if (res.status === 409) {
      const data = await res.json() as { error: string };
      alert(data.error);
      return;
    }
    if (res.ok || res.status === 204) {
      setSelectedListId(null);
      setSelectedList(null);
      await loadLists();
    }
  };

  const handleAddFeed = async () => {
    if (!feedUrl.trim() || !selectedListId) return;
    setIsAddingFeed(true);
    setAddFeedError(null);
    const res = await fetch(`/api/lists/${selectedListId}/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: feedUrl.trim() }),
    });
    if (res.ok) {
      setFeedUrl('');
      await loadListDetail(selectedListId);
      await loadLists(); // refresh feed count
    } else {
      const data = await res.json() as { error: string };
      setAddFeedError(data.error ?? t('lists.invalidFeedUrl'));
    }
    setIsAddingFeed(false);
  };

  const handleRemoveFeed = async (feedId: string) => {
    if (!selectedListId) return;
    await fetch(`/api/lists/${selectedListId}/feeds/${feedId}`, { method: 'DELETE' });
    await loadListDetail(selectedListId);
    await loadLists();
  };

  const handleUseInNewColumn = () => {
    // Dispatches a custom event that AddFeedModal listens to — keeps components decoupled
    window.dispatchEvent(new CustomEvent('open-add-column-modal', {
      detail: { tab: 'list', listId: selectedListId }
    }));
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-56 border-r border-border flex flex-col flex-shrink-0">
        <div className="px-3 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
            {t('lists.myLists')}
          </span>
          <button
            onClick={() => { setIsCreating(true); setNewListName(''); }}
            className="text-xs px-2 py-1 rounded border border-accent/40 text-accent bg-accent/10 hover:bg-accent/20 transition-colors"
          >
            {t('lists.newList')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingLists && (
            <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-foreground-secondary" /></div>
          )}

          {!isLoadingLists && lists.length === 0 && !isCreating && (
            <p className="text-xs text-foreground-secondary px-3 py-4">{t('lists.noLists')}</p>
          )}

          {lists.map((list) => {
            const isActive = list.id === selectedListId;
            const isRenaming = renamingListId === list.id;

            if (isRenaming) {
              return (
                <div key={list.id} className="px-2 py-2 border-l-2 border-accent/30 bg-accent/5">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleRename(list.id); if (e.key === 'Escape') setRenamingListId(null); }}
                    className="w-full bg-background border border-accent/40 text-foreground px-2 py-1 rounded text-sm outline-none"
                  />
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={() => void handleRename(list.id)}
                      disabled={isSavingRename}
                      className="flex-1 text-xs py-1 rounded border border-accent/40 text-accent bg-accent/10 hover:bg-accent/20"
                    >
                      {t('lists.save')}
                    </button>
                    <button
                      onClick={() => setRenamingListId(null)}
                      className="text-xs px-2 py-1 rounded border border-border text-foreground-secondary hover:bg-background-tertiary"
                    >
                      {t('lists.cancel')}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={cn(
                  'px-2 py-2 cursor-pointer border-l-2 flex items-center gap-1 group',
                  isActive
                    ? 'bg-accent/10 border-accent'
                    : 'border-transparent hover:bg-background-tertiary'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm truncate', isActive ? 'font-medium text-foreground' : 'text-foreground')}>
                    {list.name}
                  </div>
                  <div className="text-xs text-foreground-secondary mt-0.5">
                    {t('lists.feedCount').replace('{count}', String(list.feedCount))}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingListId(list.id);
                    setRenameValue(list.name);
                  }}
                  className={cn('flex-shrink-0 text-foreground-secondary hover:text-accent transition-colors', !isActive && 'opacity-0 group-hover:opacity-100')}
                  title="Rename"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {isCreating && (
            <div className="px-2 py-2 border-l-2 border-accent/30 bg-accent/5">
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateList(); if (e.key === 'Escape') setIsCreating(false); }}
                placeholder={t('lists.listNamePlaceholder')}
                className="w-full bg-background border border-accent/40 text-foreground px-2 py-1 rounded text-sm outline-none placeholder:text-foreground-secondary"
              />
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => void handleCreateList()}
                  disabled={isSavingNew || !newListName.trim()}
                  className="flex-1 text-xs py-1 rounded border border-accent/40 text-accent bg-accent/10 hover:bg-accent/20 disabled:opacity-50"
                >
                  {t('lists.create')}
                </button>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-xs px-2 py-1 rounded border border-border text-foreground-secondary hover:bg-background-tertiary"
                >
                  {t('lists.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedListId && (
          <div className="flex-1 flex items-center justify-center text-foreground-secondary text-sm">
            {t('lists.noListSelected')}
          </div>
        )}

        {selectedListId && (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <span className="text-base font-semibold text-foreground flex-1 truncate">
                {selectedList?.name ?? '…'}
              </span>
              <button
                onClick={() => void handleDeleteList()}
                className="text-xs text-red-500 opacity-60 hover:opacity-100 transition-opacity"
              >
                {t('lists.deleteList')}
              </button>
            </div>

            {/* Add feed input */}
            <div className="px-4 py-2 border-b border-border flex gap-2">
              <input
                value={feedUrl}
                onChange={(e) => { setFeedUrl(e.target.value); setAddFeedError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAddFeed(); }}
                placeholder={t('lists.pasteFeedUrl')}
                className="flex-1 bg-background-tertiary border border-border text-foreground px-3 py-1.5 rounded text-sm outline-none focus:border-accent placeholder:text-foreground-secondary"
              />
              <button
                onClick={() => void handleAddFeed()}
                disabled={isAddingFeed || !feedUrl.trim()}
                className="text-xs px-3 py-1.5 rounded border border-accent/40 text-accent bg-accent/10 hover:bg-accent/20 disabled:opacity-50 whitespace-nowrap"
              >
                {isAddingFeed ? t('lists.addingFeed') : t('lists.addFeed')}
              </button>
            </div>
            {addFeedError && (
              <p className="text-xs text-red-500 px-4 py-1">{addFeedError}</p>
            )}

            {/* Feed list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {isLoadingDetail && (
                <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-foreground-secondary" /></div>
              )}

              {!isLoadingDetail && selectedList?.items.map((item) => (
                <div
                  key={item.feedListItemId}
                  className="flex items-center gap-3 bg-background-tertiary border border-border rounded-lg px-3 py-2"
                >
                  <GripVertical className="w-4 h-4 text-foreground-secondary flex-shrink-0 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                    <div className="text-xs text-foreground-secondary truncate">
                      {item.siteUrl ? new URL(item.siteUrl).hostname : item.url}
                    </div>
                  </div>
                  <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', item.lastError ? 'bg-red-500' : 'bg-accent')} />
                  <button
                    onClick={() => void handleRemoveFeed(item.id)}
                    className="text-foreground-secondary hover:text-foreground flex-shrink-0 p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {!isLoadingDetail && selectedList?.items.length === 0 && (
                <p className="text-sm text-foreground-secondary py-4 text-center">No feeds yet. Paste a URL above to add one.</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-foreground-secondary">
                {`${lists.find((l) => l.id === selectedListId)?.feedCount ?? 0} feeds`}
              </span>
              <button
                onClick={handleUseInNewColumn}
                className="text-xs px-3 py-1.5 rounded bg-accent text-white font-semibold hover:bg-accent/90 transition-colors"
              >
                {t('lists.useInNewColumn')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

> **Note:** The "Used by N columns" count in the footer currently uses `feedCount` as a placeholder — Task 4's repository provides `getColumnsUsingList`. For now the footer shows the list's own `feedCount`. A follow-up improvement could add a `columnCount` field to `FeedList`, but this is out of scope for the MVP.

- [ ] **Step 5: Create `app/lists/page.tsx`**

```tsx
import { TopNavBar } from '@/components/ui/TopNavBar';
import { FeedListManager } from '@/components/ui/FeedListManager';

export default function ListsPage() {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <TopNavBar />
      <div className="flex-1 overflow-hidden">
        <FeedListManager />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/fong/SynologyDrive/Jarvis/Projects/rssdeck && npx tsc --noEmit
```

- [ ] **Step 7: Smoke test manually**

Start dev server and navigate to `http://localhost:3000/lists`. Verify:
- Left panel shows "My Lists" with "+ New" button
- Creating a list adds it to the left panel
- Renaming via pencil icon works inline
- Adding a feed URL validates and shows the feed in the right panel
- Removing a feed works

- [ ] **Step 8: Commit**

```bash
git add app/lists/ components/ui/FeedListManager.tsx components/ui/TopNavBar.tsx lib/i18n/en.json lib/i18n/zh-CN.json
git commit -m "feat: add Feed List Manager page with nav and i18n"
```

---

## Task 6: Updated Add Column Modal

**Files:**
- Modify: `components/ui/AddFeedModal.tsx`

The existing modal has three tabs: `url`, `categories`, `opml`. We replace `url` and `categories` with `list` and `search`. The `opml` tab is kept unchanged.

### Steps

- [ ] **Step 1: Add new state and types at the top of `AddFeedModal`**

Replace the `Tab` type definition:
```ts
type Tab = 'list' | 'search' | 'opml';
```

Add new state variables after existing ones:
```ts
const [lists, setLists] = useState<FeedList[]>([]);
const [searchRules, setSearchRules] = useState<SearchRule[]>([]);
const [selectedListId, setSelectedListId] = useState<string | null>(null);
const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
const [columnTitle, setColumnTitle] = useState('');
const [isLoadingLists, setIsLoadingLists] = useState(false);
const [isCreatingList, setIsCreatingList] = useState(false);
const [newListName, setNewListName] = useState('');
```

Add required imports:
```ts
import type { FeedList, FeedListWithItems, SearchRule } from '@/lib/types';
```

`SearchRule` is the client-safe interface added to `lib/types.ts` in Task 1. Do **not** import `SavedSearchRule` from `@/lib/server/search-repository` — that module has `import 'server-only'` and will break the client bundle.

- [ ] **Step 2: Add a `useEffect` to load lists and search rules when the modal opens**

```ts
useEffect(() => {
  if (!isOpen) return;
  setActiveTab('list');
  setIsLoadingLists(true);
  Promise.all([
    fetch('/api/lists').then((r) => r.json()),
    fetch('/api/search/rules').then((r) => r.json()),
  ]).then(([listsData, rulesData]) => {
    setLists(listsData as FeedList[]);
    setSearchRules(rulesData as SearchRule[]);
    setIsLoadingLists(false);
  }).catch(() => setIsLoadingLists(false));
}, [isOpen]);
```

- [ ] **Step 3: Add a `useEffect` to listen for the `open-add-column-modal` event (from FeedListManager "Use in New Column" button)**

```ts
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ tab: string; listId?: string }>).detail;
    if (detail.tab === 'list' && detail.listId) {
      setSelectedListId(detail.listId);
      setActiveTab('list');
    }
    // Trigger modal open through existing parent mechanism
  };
  window.addEventListener('open-add-column-modal', handler);
  return () => window.removeEventListener('open-add-column-modal', handler);
}, []);
```

> **Note:** The `open-add-column-modal` event only pre-selects the list. The parent component that renders `<AddFeedModal>` needs to call `setIsAddFeedModalOpen(true)` itself. The Deck page already has this state — check `app/page.tsx` to confirm the event also triggers `isOpen`. If it doesn't, you can add a `useEffect` in the Deck page that opens the modal on this event.

- [ ] **Step 4: Add the "From List" tab UI replacing the URL tab**

Replace the entire modal body's tab content section. The modal already renders tabs and a body — locate the `activeTab === 'url'` and `activeTab === 'categories'` branches and replace with:

**List tab content:**
```tsx
{activeTab === 'list' && (
  <div className="flex-1 flex flex-col gap-2 overflow-y-auto p-4">
    {isLoadingLists && <Loader2 className="w-4 h-4 animate-spin text-foreground-secondary mx-auto mt-8" />}

    {!isLoadingLists && lists.map((list) => {
      const isSelected = list.id === selectedListId;
      return (
        <div
          key={list.id}
          onClick={() => { setSelectedListId(list.id); setColumnTitle(list.name); }}
          className={cn(
            'flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
            isSelected
              ? 'border-accent/50 bg-accent/10'
              : 'border-border bg-background-tertiary hover:border-accent/30'
          )}
        >
          <div className={cn('w-4 h-4 rounded flex-shrink-0 flex items-center justify-center', isSelected ? 'bg-accent' : 'bg-border')}>
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground font-medium truncate">{list.name}</div>
            <div className="text-xs text-foreground-secondary mt-0.5">
              {list.feedCount} feed{list.feedCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      );
    })}

    {/* Create new list row */}
    {!isCreatingList && (
      <div
        onClick={() => { setIsCreatingList(true); setNewListName(''); }}
        className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 cursor-pointer hover:border-accent/40 transition-colors"
      >
        <div className="w-4 h-4 rounded bg-border flex items-center justify-center flex-shrink-0">
          <Plus className="w-3 h-3 text-foreground-secondary" />
        </div>
        <span className="text-sm text-foreground-secondary">Create new list…</span>
      </div>
    )}

    {isCreatingList && (
      <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 flex flex-col gap-2">
        <input
          autoFocus
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') setIsCreatingList(false); }}
          placeholder="List name…"
          className="bg-background border border-border text-foreground px-2 py-1 rounded text-sm outline-none focus:border-accent placeholder:text-foreground-secondary w-full"
        />
        <div className="flex gap-2">
          <button
            disabled={!newListName.trim()}
            onClick={async () => {
              const res = await fetch('/api/lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newListName }),
              });
              if (res.ok) {
                const created: FeedList = await res.json();
                const updated = await fetch('/api/lists').then((r) => r.json()) as FeedList[];
                setLists(updated);
                setIsCreatingList(false);
                setSelectedListId(created.id);
                setColumnTitle(created.name);
              }
            }}
            className="flex-1 text-xs py-1 rounded border border-accent/40 text-accent bg-accent/10 hover:bg-accent/20 disabled:opacity-50"
          >
            Create
          </button>
          <button
            onClick={() => setIsCreatingList(false)}
            className="text-xs px-3 py-1 rounded border border-border text-foreground-secondary"
          >
            ✕
          </button>
        </div>
      </div>
    )}
  </div>
)}
```

**Search Rule tab content:**
```tsx
{activeTab === 'search' && (
  <div className="flex-1 flex flex-col gap-2 overflow-y-auto p-4">
    <p className="text-xs text-foreground-secondary mb-2">
      Pick a saved search rule — articles matching its keywords auto-refresh from the database.
    </p>
    {searchRules.map((rule) => {
      const isSelected = rule.id === selectedRuleId;
      return (
        <div
          key={rule.id}
          onClick={() => { setSelectedRuleId(rule.id); setColumnTitle(rule.query); }}
          className={cn(
            'flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
            isSelected
              ? 'border-accent/50 bg-accent/10'
              : 'border-border bg-background-tertiary hover:border-accent/30'
          )}
        >
          <div className={cn('w-4 h-4 rounded flex-shrink-0 flex items-center justify-center', isSelected ? 'bg-accent' : 'bg-border')}>
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground font-medium truncate">{rule.name || rule.query}</div>
            <div className="text-xs text-foreground-secondary mt-0.5">
              {rule.keywords.length} keyword{rule.keywords.length !== 1 ? 's' : ''}
              {rule.lastRunAt && ` · last run ${new Date(rule.lastRunAt).toLocaleString()}`}
            </div>
          </div>
        </div>
      );
    })}
    {searchRules.length === 0 && !isLoadingLists && (
      <p className="text-sm text-foreground-secondary py-4 text-center">
        No saved search rules yet. Create one on the Search page first.
      </p>
    )}
  </div>
)}
```

- [ ] **Step 5: Update the modal tab bar**

Replace the existing tabs (`url`, `categories`) with:
```tsx
const tabs: { key: Tab; label: string }[] = [
  { key: 'list', label: 'From List' },
  { key: 'search', label: 'Search Rule' },
  { key: 'opml', label: 'OPML' },
];
```

- [ ] **Step 6: Update the modal footer "Create Column" button**

The footer needs to handle both `list` and `search` tabs. Replace the existing submit logic with:

```ts
const handleCreateColumn = async () => {
  if (activeTab === 'list' && selectedListId) {
    const column: Column = {
      id: generateId(),
      title: columnTitle || lists.find((l) => l.id === selectedListId)?.name ?? 'New Column',
      type: 'list',
      sources: [],
      settings: { refreshInterval: defaultRefreshInterval, viewMode: defaultViewMode },
      width: DEFAULT_COLUMN_WIDTH,
      feedListId: selectedListId,
    };
    const deckState = await createColumnRequest(column);
    applyDeckState(deckState);
    onClose();
    return;
  }

  if (activeTab === 'search' && selectedRuleId) {
    const column: Column = {
      id: generateId(),
      title: columnTitle || searchRules.find((r) => r.id === selectedRuleId)?.query ?? 'Search Column',
      type: 'search',
      sources: [],
      settings: { refreshInterval: defaultRefreshInterval, viewMode: defaultViewMode },
      width: DEFAULT_COLUMN_WIDTH,
      searchRuleId: selectedRuleId,
    };
    const deckState = await createColumnRequest(column);
    applyDeckState(deckState);
    onClose();
    return;
  }

  // OPML tab — existing logic stays unchanged
};
```

The footer should show the selected item name and disable "Create Column" until a selection is made:
```tsx
<div className="flex items-center justify-between px-4 py-3 border-t border-border">
  <span className="text-xs text-foreground-secondary truncate max-w-[60%]">
    {activeTab === 'list' && selectedListId && lists.find((l) => l.id === selectedListId)?.name}
    {activeTab === 'search' && selectedRuleId && (searchRules.find((r) => r.id === selectedRuleId)?.name || searchRules.find((r) => r.id === selectedRuleId)?.query)}
  </span>
  <button
    onClick={() => void handleCreateColumn()}
    disabled={(activeTab === 'list' && !selectedListId) || (activeTab === 'search' && !selectedRuleId)}
    className="text-sm px-4 py-1.5 rounded bg-accent text-white font-semibold hover:bg-accent/90 disabled:opacity-40 transition-colors"
  >
    Create Column
  </button>
</div>
```

- [ ] **Step 7: Add `applyDeckState` to the modal's existing store wiring**

The modal already has `setColumns` and `setSavedFeeds`. Add a helper:
```ts
const applyDeckState = (deckState: DeckStateSnapshot) => {
  setColumns(deckState.columns);
  setSavedFeeds(deckState.savedFeeds);
};
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /Users/fong/SynologyDrive/Jarvis/Projects/rssdeck && npx tsc --noEmit
```

- [ ] **Step 9: Smoke test the modal**

Start dev server. Open the deck (home page), click the "Add Column" button. Verify:
- Modal opens with "From List" tab showing all lists
- Selecting a list enables "Create Column"
- "Search Rule" tab shows saved rules
- Creating a column from a list adds it to the deck with `type: 'list'`

- [ ] **Step 10: Commit**

```bash
git add components/ui/AddFeedModal.tsx
git commit -m "feat: replace URL/categories tabs in AddFeedModal with From List and Search Rule tabs"
```

---

## Task 7: Column Refresh for List and Search Column Types

**Files:**
- Modify: `components/deck/Column.tsx`

### Steps

- [ ] **Step 1: Update `fetchFeeds` to handle `'list'` and `'search'` column types**

In `components/deck/Column.tsx`, the `fetchFeeds` function starts at line 118. The current guard is:

```ts
if (column.sources.length === 0) {
  setArticles([]);
  setIsLoading(false);
  return;
}
```

Replace this entire guard with logic that branches on `column.type`:

```ts
const fetchFeeds = useCallback(async () => {
  // Search column: fetch articles from the DB via dedicated endpoint
  if (column.type === 'search') {
    try {
      const res = await fetch(`/api/deck/columns/${column.id}/articles`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Search rule was deleted');
        } else {
          setError('Failed to load search results');
        }
        return;
      }
      const results = await res.json() as SearchResult[];
      const articles: Article[] = results.map((r) => ({
        id: r.id,
        title: r.title,
        link: r.url,
        pubDate: r.publishedAt ?? '',
        contentSnippet: r.contentSnippet ?? undefined,
        sourceTitle: r.sourceTitle ?? undefined,
        sourceUrl: r.sourceUrl ?? undefined,
      }));
      setArticles(articles);
      setColumnArticles(column.id, articles);
      setError(null);
    } catch (err) {
      setError('Failed to load search results');
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
    return;
  }

  // List column: fetch list's feeds, then use RSS pipeline
  let sources = column.sources;
  if (column.type === 'list') {
    if (!column.feedListId) {
      setError('Source list was deleted');
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/lists/${column.feedListId}`);
      if (!res.ok) {
        setError('Source list was deleted');
        setIsLoading(false);
        return;
      }
      const list = await res.json() as FeedListWithItems;
      sources = list.items;
    } catch {
      setError('Failed to load list feeds');
      setIsLoading(false);
      return;
    }
  }

  // Legacy/list: RSS fetch pipeline
  if (sources.length === 0) {
    setArticles([]);
    setIsLoading(false);
    return;
  }

  try {
    const allArticles: Article[] = [];

    await Promise.all(
      sources.map(async (source) => {
        try {
          const res = await fetch(`/api/rss?url=${encodeURIComponent(source.url)}`);
          if (!res.ok) throw new Error(`Failed to fetch ${source.title}`);
          const data = await res.json();
          if (data.items) {
            allArticles.push(...data.items);
          }
        } catch (err) {
          console.error(`Error fetching ${source.url}:`, err);
        }
      })
    );

    allArticles.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    const uniqueArticles = deduplicateArticles(allArticles);

    setArticles(uniqueArticles);
    setColumnArticles(column.id, uniqueArticles);
    setError(null);
  } catch (err) {
    setError('Failed to load feeds');
    console.error(err);
  } finally {
    setIsLoading(false);
    setIsRefreshing(false);
  }
}, [column.sources, column.id, column.type, column.feedListId, column.searchRuleId, setColumnArticles]);
```

- [ ] **Step 2: Add required type imports to `Column.tsx`**

Find the existing imports at the top of the file. Add `FeedListWithItems` to the types import:
```ts
import type { Article, Column as ColumnType, FeedListWithItems } from '@/lib/types';
```

Add a local `SearchResult` type (to avoid importing server-only code on the client):
```ts
type SearchResult = {
  id: string; title: string; url: string; publishedAt: string | null;
  sourceTitle: string | null; sourceUrl: string | null; contentSnippet: string | null;
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/fong/SynologyDrive/Jarvis/Projects/rssdeck && npx tsc --noEmit
```

- [ ] **Step 4: End-to-end test**

1. Create a feed list with 2–3 feeds on `/lists`
2. Open the "Add Column" modal, pick the list, create the column
3. Verify the column loads articles from all feeds in the list
4. Create a search column using a saved search rule
5. Verify the search column shows articles from the DB

- [ ] **Step 5: Commit**

```bash
git add components/deck/Column.tsx
git commit -m "feat: Column.tsx handles list and search column types for article refresh"
```

---

## Complete

After all tasks are done, run a final check:

```bash
cd /Users/fong/SynologyDrive/Jarvis/Projects/rssdeck && npx tsc --noEmit
```

Then use `superpowers:finishing-a-development-branch` to merge or create a PR.
