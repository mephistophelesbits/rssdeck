import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { runArticleSearch } from '@/lib/server/search-repository';
import Parser from 'rss-parser';
import { Article } from '@/lib/types';

const parser = new Parser({
    customFields: {
        item: [
            ['media:thumbnail', 'mediaThumbnail'],
            ['media:content', 'mediaContent'],
            ['enclosure', 'enclosure'],
            ['content:encoded', 'contentEncoded'],
            ['dc:creator', 'dcCreator'],
        ],
    },
    headers: {
        'User-Agent': 'RSS-Deck/1.0 (RSS Reader Application)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
    timeout: 10000,
});

type ColumnRow = {
    id: string;
    type: string;
    feed_list_id: string | null;
    search_rule_id: string | null;
};

type FeedListItemRow = {
    url: string;
};

type SearchRuleRow = {
    id: string;
    name: string;
    query: string;
    keywords_json: string;
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ columnId: string }> }
) {
    try {
        const { columnId } = await params;
        const db = getDb();

        const column = db.prepare(`
      SELECT id, type, feed_list_id, search_rule_id
      FROM columns_state
      WHERE id = ?
    `).get(columnId) as ColumnRow | undefined;

        if (!column) {
            return NextResponse.json({ error: 'Column not found' }, { status: 404 });
        }

        if (column.type === 'list' && column.feed_list_id) {
            // Fetch articles from feeds in the list
            const feedUrls = db.prepare(`
        SELECT sf.url
        FROM feed_list_items fli
        JOIN saved_feeds sf ON sf.id = fli.feed_id
        WHERE fli.list_id = ?
        ORDER BY fli.position ASC
      `).all(column.feed_list_id) as FeedListItemRow[];

            const articles = await fetchArticlesFromFeeds(feedUrls.map(f => f.url));

            // Sort by pubDate descending
            articles.sort((a, b) => {
                const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
                const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
                return dateB - dateA;
            });

            return NextResponse.json(articles);
        }

        if (column.type === 'search' && column.search_rule_id) {
            // Fetch articles using search rule
            const searchRule = db.prepare(`
        SELECT id, name, query, keywords_json
        FROM search_rules
        WHERE id = ?
      `).get(column.search_rule_id) as SearchRuleRow | undefined;

            if (!searchRule) {
                return NextResponse.json({ error: 'Search rule not found' }, { status: 404 });
            }

            const searchResult = runArticleSearch(searchRule.query);

            // Convert SearchResult to Article format
            const articles: Article[] = searchResult.results.map(r => ({
                id: r.id,
                title: r.title,
                link: r.url,
                pubDate: r.publishedAt || new Date().toISOString(),
                contentSnippet: r.contentSnippet || undefined,
                content: r.rawContent || undefined,
                sourceTitle: r.sourceTitle || undefined,
                sourceUrl: r.sourceUrl || undefined,
            }));

            return NextResponse.json(articles);
        }

        return NextResponse.json({ error: 'Column type not supported for article fetching' }, { status: 400 });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch articles' },
            { status: 500 },
        );
    }
}

async function fetchArticlesFromFeeds(urls: string[]): Promise<Article[]> {
    const allArticles: Article[] = [];

    for (const url of urls) {
        try {
            const fetchUrl = url.startsWith('http') ? url : `http://${url}`;

            const attempts: Array<() => Promise<Article[]>> = [
                async () => {
                    const rssResponse = await fetch(fetchUrl, {
                        headers: {
                            'User-Agent': 'RSS-Deck/1.0 (RSS Reader Application)',
                            Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
                            'Accept-Language': 'en-US,en;q=0.9',
                        },
                        redirect: 'follow',
                    });

                    if (!rssResponse.ok) {
                        throw new Error(`HTTP error! status: ${rssResponse.status}`);
                    }

                    const xml = await rssResponse.text();
                    const feed = await parser.parseString(xml);
                    return feed.items.map((item) => {
                        const itemRecord = item as unknown as Record<string, unknown>;
                        return {
                            id: item.guid || item.link || `generated-${Date.now()}-${Math.random()}`,
                            title: item.title || 'Untitled',
                            link: item.link || '',
                            pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
                            contentSnippet: item.contentSnippet?.slice(0, 300),
                            content: (itemRecord.contentEncoded as string) || item.content,
                            author: (itemRecord.dcCreator as string) || item.creator,
                            thumbnail: extractThumbnail(itemRecord),
                            sourceTitle: feed.title,
                            sourceUrl: feed.link,
                        } as Article;
                    });
                },
                async () => {
                    const feed = await parser.parseURL(fetchUrl);
                    return feed.items.map((item) => {
                        const itemRecord = item as unknown as Record<string, unknown>;
                        return {
                            id: item.guid || item.link || `generated-${Date.now()}-${Math.random()}`,
                            title: item.title || 'Untitled',
                            link: item.link || '',
                            pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
                            contentSnippet: item.contentSnippet?.slice(0, 300),
                            content: (itemRecord.contentEncoded as string) || item.content,
                            author: (itemRecord.dcCreator as string) || item.creator,
                            thumbnail: extractThumbnail(itemRecord),
                            sourceTitle: feed.title,
                            sourceUrl: feed.link,
                        } as Article;
                    });
                },
            ];

            let lastError: Error | null = null;
            for (const attempt of attempts) {
                try {
                    const articles = await attempt();
                    allArticles.push(...articles);
                    break;
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error('Failed to parse feed');
                }
            }
        } catch (error) {
            // Skip failed feeds silently
            console.error(`Failed to fetch feed ${url}:`, error);
        }
    }

    return allArticles;
}

function extractThumbnail(item: Record<string, unknown>): string | undefined {
    if (item.mediaThumbnail && typeof item.mediaThumbnail === 'object') {
        const thumb = item.mediaThumbnail as { $?: { url?: string } };
        if (thumb.$?.url) return thumb.$.url;
    }

    if (item.mediaContent && typeof item.mediaContent === 'object') {
        const media = item.mediaContent as { $?: { url?: string } };
        if (media.$?.url) return media.$.url;
    }

    if (item.enclosure && typeof item.enclosure === 'object') {
        const enc = item.enclosure as { url?: string; type?: string };
        if (enc.url && enc.type?.startsWith('image/')) {
            return enc.url;
        }
    }

    return undefined;
}
