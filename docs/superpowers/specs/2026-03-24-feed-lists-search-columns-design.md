# Feed Lists & Search Columns Design

## Goal

Replace per-column URL entry with named **Lists** — reusable, named collections of feed sources. Users manage feeds through lists, create columns by picking a list, and can also create columns from saved search rules that auto-refresh from the articles database.

## Architecture

**Approach: Additive.** Existing columns are untouched — they continue working via `sources_json`. New capabilities are layered on top via two new tables and two new nullable columns on `columns_state`. No data migration required.

---

## Data Model

### New table: `feed_lists`

```sql
CREATE TABLE feed_lists (
  id         TEXT PRIMARY KEY,   -- nanoid
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### New table: `feed_list_items`

```sql
CREATE TABLE feed_list_items (
  id         TEXT PRIMARY KEY,   -- nanoid
  list_id    TEXT NOT NULL REFERENCES feed_lists(id) ON DELETE CASCADE,
  feed_id    TEXT NOT NULL REFERENCES saved_feeds(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Prevent duplicate feeds within the same list
CREATE UNIQUE INDEX idx_feed_list_items_list_feed
  ON feed_list_items(list_id, feed_id);

-- Fast lookup of all feeds in a list, ordered
CREATE INDEX idx_feed_list_items_list_id
  ON feed_list_items(list_id, position);
```

When a user adds a feed URL to a list: upsert into `saved_feeds` first (existing `persistFeeds` logic), then insert into `feed_list_items` using the returned `feed.id`. If the `(list_id, feed_id)` pair already exists, ignore the duplicate (no error).

### Modified table: `columns_state`

Add two nullable columns using the existing `ensureColumn()` helper:

```ts
ensureColumn(db, 'columns_state', 'feed_list_id', 'TEXT');
ensureColumn(db, 'columns_state', 'search_rule_id', 'TEXT');
```

Existing rows have both as NULL and continue using `sources_json` unchanged.

**`sources_json` for new column types:** list columns and search columns must still satisfy the `sources_json TEXT NOT NULL` constraint. Set `sources_json = '[]'` (empty array) for both. The `createColumn()` call must pass `sources: []`.

### `saved_feeds` — unchanged

Remains the deduplicated URL registry. `feed_list_items.feed_id` points into it.

---

## Column Types

Four types — discriminated by the `type` field and the presence of `feedListId` / `searchRuleId`:

| Type value | `feedListId` | `searchRuleId` | Article source |
|---|---|---|---|
| `'single-feed'`, `'category'`, `'unified'` (legacy) | NULL | NULL | `sources_json` as today |
| **`'list'`** (new) | set | NULL | Feeds resolved from `feed_list_items → saved_feeds` at refresh time |
| **`'search'`** (new) | NULL | set | `articles` table queried via `runArticleSearch()` |

TypeScript `Column` interface gains:
```ts
type: 'single-feed' | 'category' | 'unified' | 'list' | 'search';
feedListId?: string;
searchRuleId?: string;
```

---

## Repository Layer

Create `lib/server/feed-lists-repository.ts` with these functions:

```ts
getFeedLists(db): FeedList[]
// Returns all lists ordered by name, with feed count

getFeedListById(db, listId): FeedList | null
// Returns list with its feed items (joined to saved_feeds)

createFeedList(db, name: string): FeedList
// Inserts new list, returns it

renameFeedList(db, listId: string, name: string): FeedList
// Updates name, sets updated_at

deleteFeedList(db, listId: string): void
// Blocked if list is used by any column — throws if getColumnsUsingList returns count > 0

addFeedToList(db, listId: string, feedUrl: string): FeedListItem
// Upserts feed into saved_feeds, then inserts into feed_list_items
// ON CONFLICT (list_id, feed_id) DO NOTHING

removeFeedFromList(db, listId: string, feedId: string): void
// Deletes from feed_list_items

reorderFeedListItems(db, listId: string, orderedFeedIds: string[]): void
// Updates position values in one transaction

getColumnsUsingList(db, listId: string): number
// COUNT of columns_state rows WHERE feed_list_id = listId
```

Types:
```ts
export interface FeedList {
  id: string;
  name: string;
  feedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeedListWithItems extends FeedList {
  items: Array<FeedSource & { position: number }>;
}
```

### Updates to `deck-repository.ts`

- `createColumn()` INSERT: add `feed_list_id, search_rule_id` to the column list and `?, ?` to values
- `updateColumn()` UPDATE SET: add `feed_list_id = ?, search_rule_id = ?`
- `getColumns()` SELECT: add `feed_list_id, search_rule_id` to the SELECT list and map them onto the `Column` object
- `ColumnRow` type: add `feed_list_id: string | null` and `search_rule_id: string | null`

---

## API Routes

All routes follow existing patterns in `app/api/`. Use `getDb()` server-side.

### Feed list CRUD

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/api/lists` | — | `FeedList[]` |
| `POST` | `/api/lists` | `{ name }` | `FeedList` |
| `PATCH` | `/api/lists/[listId]` | `{ name }` | `FeedList` |
| `DELETE` | `/api/lists/[listId]` | — | `204` or `409` if in use |
| `GET` | `/api/lists/[listId]` | — | `FeedListWithItems` |
| `POST` | `/api/lists/[listId]/feeds` | `{ url }` | `FeedListItem` |
| `DELETE` | `/api/lists/[listId]/feeds/[feedId]` | — | `204` |
| `POST` | `/api/lists/[listId]/feeds/reorder` | `{ orderedFeedIds: string[] }` | `204` |

### Article fetching for list and search columns

| Method | Path | Query | Response |
|---|---|---|---|
| `GET` | `/api/deck/columns/[columnId]/articles` | — | `Article[]` |

This endpoint reads the column row to determine type:
- **`'list'`**: fetch `feed_list_items → saved_feeds`, call existing RSS fetch pipeline for each URL, merge and sort by `published_at`
- **`'search'`**: load `keywords_json` from the referenced `search_rule`, call `runArticleSearch()` from `search-repository.ts` (reuse existing full-featured search: relevance scoring, entity matching, etc.), return results sorted by `published_at`

---

## Client-Side Refresh

### List columns and search columns

The existing `Column.tsx` fetches articles by calling `/api/rss?url=...` for each source. For `'list'` and `'search'` columns, the client has no `sources` to iterate. Instead:

- In `Column.tsx`, check `column.type`:
  - If `'list'` or `'search'`: call `GET /api/deck/columns/[column.id]/articles`
  - Otherwise: existing `sources.map(s => fetch('/api/rss?url=...'))` as today

The same `refreshInterval` setting drives the polling interval for all column types.

### `DeckStateSnapshot` and client store

`getColumns()` now returns `feedListId` and `searchRuleId` on each column. `DeckStateSnapshot` in `lib/store.ts` / `lib/rssdeck-store.ts` must include these fields on the `Column` type so the client can read `column.type` and `column.feedListId`.

---

## Feed List Manager Page

**Location:** New Next.js page at `app/lists/page.tsx`. Accessible via a new nav item in the sidebar (alongside existing nav items). Uses the same `TopNavBar` layout as other pages.

**Layout:** Two-panel.

### Left panel — list directory

- Lists each `feed_list` with name and feed count
- **✎ pencil icon** on each row — clicking replaces the row inline with a name input + Save / ✕; calls `PATCH /api/lists/[listId]` on Save
- **"+ New" button** at top — inserts an inline name input at bottom with Create / ✕; calls `POST /api/lists` on Create
- Active list highlighted with accent left border

### Right panel — selected list detail

- **Feed rows** — drag handle (⠿) for reorder (`POST /api/lists/[listId]/feeds/reorder`), title, domain, health dot, × to remove (`DELETE /api/lists/[listId]/feeds/[feedId]`)
- **"Paste feed URL" input + "+ Add" button** — calls `POST /api/lists/[listId]/feeds`
- **"Delete list" button** — calls `DELETE /api/lists/[listId]`; if response is `409`, shows tooltip "Used by N columns — remove from those columns first"
- **"Use in New Column →" button** — opens Add Column modal pre-selected on this list
- Footer: "Used by N columns" count

---

## Add Column Modal

Replaces `components/ui/AddFeedModal.tsx`. Two tabs:

### Tab 1: From List

- Lists all `feed_lists` with name, feed count, and short feed name preview
- Single selection via checkbox
- **"Create new list…"** dashed row at bottom — inline: name input → add feed URLs → Create → auto-selects the new list
- Column title auto-fills from selected list name (editable)

### Tab 2: Search Rule

- Lists all `search_rules` with name/keywords and last run time
- Single selection via checkbox
- Column title auto-fills from the rule's query string (editable)
- Description: "Articles matching these keywords auto-refresh from the database."

### Footer

- Shows selected item name
- "Create Column" button — disabled until a selection is made
- Creates column with `type: 'list'` or `type: 'search'`, `sources: []`, and `feedListId` or `searchRuleId` set

---

## Error Handling

- **Invalid feed URL** in list: show error on feed row; do not block other feeds
- **Empty list**: column shows empty state ("No articles yet")
- **Deleted list (defensive)**: if a list is somehow deleted while a column references it (e.g. direct DB access), column shows "Source list was deleted"; `DELETE /api/lists/[listId]` via the UI is blocked when the list is in use (returns `409`)
- **Deleted search rule (defensive)**: column shows "Search rule was deleted"
- **Duplicate feed URL in list**: silently ignored (unique index `ON CONFLICT DO NOTHING`)

---

## Out of Scope

- OPML import (existing flow unchanged; imported feeds go into `saved_feeds` only)
- Bulk-adding feeds to a list from OPML
- Sharing lists between users
- Per-list refresh intervals (columns control refresh rate)
