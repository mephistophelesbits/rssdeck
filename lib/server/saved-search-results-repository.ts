import 'server-only';

import { nanoid } from 'nanoid';
import { getDb } from './db';
import type { SearchResult } from './search-repository';

export interface SavedSearchResult {
  id: string;
  searchRuleId: string;
  article: SearchResult;
  matchedTerms: string[];
  relevanceScore: number;
  createdAt: string;
}

export interface SavedSearchResultInput {
  searchRuleId: string;
  article: SearchResult;
}

/**
 * Save multiple search results to the database
 */
export function saveSearchResults(results: SavedSearchResultInput[]): SavedSearchResult[] {
  if (!results.length) return [];

  const db = getDb();
  const savedResults: SavedSearchResult[] = [];

  const stmt = db.prepare(`
    INSERT INTO saved_search_results (id, search_rule_id, article_json, matched_terms_json, relevance_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  for (const result of results) {
    const id = nanoid();
    const matchedTermsJson = JSON.stringify(result.article.matchedTerms || []);
    const articleJson = JSON.stringify(result.article);

    stmt.run(
      id,
      result.searchRuleId,
      articleJson,
      matchedTermsJson,
      result.article.relevance,
      now
    );

    savedResults.push({
      id,
      searchRuleId: result.searchRuleId,
      article: result.article,
      matchedTerms: result.article.matchedTerms || [],
      relevanceScore: result.article.relevance,
      createdAt: now,
    });
  }

  return savedResults;
}

/**
 * Get all saved results for a specific search rule
 */
export function getSavedResultsByRuleId(searchRuleId: string): SavedSearchResult[] {
  const db = getDb();

  const results = db
    .prepare(
      `
    SELECT id, search_rule_id, article_json, matched_terms_json, relevance_score, created_at
    FROM saved_search_results
    WHERE search_rule_id = ?
    ORDER BY relevance_score DESC, created_at DESC
  `
    )
    .all(searchRuleId) as Array<{
    id: string;
    search_rule_id: string;
    article_json: string;
    matched_terms_json: string;
    relevance_score: number;
    created_at: string;
  }>;

  return results.map((row) => ({
    id: row.id,
    searchRuleId: row.search_rule_id,
    article: JSON.parse(row.article_json),
    matchedTerms: JSON.parse(row.matched_terms_json),
    relevanceScore: row.relevance_score,
    createdAt: row.created_at,
  }));
}

/**
 * Delete a saved search result
 */
export function deleteSavedSearchResult(id: string): boolean {
  const db = getDb();

  const result = db.prepare('DELETE FROM saved_search_results WHERE id = ?').run(id);

  return (result.changes ?? 0) > 0;
}

/**
 * Delete all saved results for a search rule (called when rule is deleted)
 */
export function deleteSavedResultsByRuleId(searchRuleId: string): number {
  const db = getDb();

  const result = db.prepare('DELETE FROM saved_search_results WHERE search_rule_id = ?').run(searchRuleId);

  return result.changes ?? 0;
}

/**
 * Get all unique articles from saved search results for a rule (used for briefing generation)
 */
export function getArticlesFromSavedSearchResults(searchRuleId: string): SearchResult[] {
  const db = getDb();

  const results = db
    .prepare(
      `
    SELECT DISTINCT article_json
    FROM saved_search_results
    WHERE search_rule_id = ?
    ORDER BY relevance_score DESC
  `
    )
    .all(searchRuleId) as Array<{ article_json: string }>;

  return results.map((row) => JSON.parse(row.article_json));
}
