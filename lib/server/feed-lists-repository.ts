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

  db.prepare(`
    INSERT INTO saved_feeds (id, url, title, site_url, last_fetched_at, last_error, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      title = excluded.title,
      site_url = COALESCE(excluded.site_url, saved_feeds.site_url),
      updated_at = excluded.updated_at
  `).run(feed.id, feed.url, feed.title, feed.siteUrl ?? null, feed.lastFetchedAt ?? null, feed.lastError ?? null, now, now);

  const savedFeed = db.prepare(`SELECT id FROM saved_feeds WHERE url = ?`).get(feed.url) as { id: string };

  const maxPos = db.prepare(`SELECT COALESCE(MAX(position), -1) AS m FROM feed_list_items WHERE list_id = ?`).get(listId) as { m: number };
  const position = maxPos.m + 1;

  const itemId = nanoid();
  db.prepare(`
    INSERT INTO feed_list_items (id, list_id, feed_id, position, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(list_id, feed_id) DO NOTHING
  `).run(itemId, listId, savedFeed.id, position, now);

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
