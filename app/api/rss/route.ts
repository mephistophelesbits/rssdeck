import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { Article, FeedResponse } from '@/lib/types';
import { generateId } from '@/lib/utils';

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
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
  timeout: 10000,
});

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'Missing URL parameter' },
      { status: 400 }
    );
  }

  // Ensure URL has protocol
  let fetchUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    fetchUrl = 'http://' + url;
  }

  try {
    const rssResponse = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'RSS-Deck/1.0 (RSS Reader Application)',
      },
    });

    if (!rssResponse.ok) {
      throw new Error(`HTTP error! status: ${rssResponse.status}`);
    }

    const xml = await rssResponse.text();
    const feed = await parser.parseString(xml);

    const items: Article[] = feed.items.map((item) => {
      const itemRecord = item as unknown as Record<string, unknown>;
      return {
        id: item.guid || item.link || crypto.randomUUID(),
        title: item.title || 'Untitled',
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        contentSnippet: item.contentSnippet?.slice(0, 300),
        content: (itemRecord.contentEncoded as string) || item.content,
        author: (itemRecord.dcCreator as string) || item.creator,
        thumbnail: extractThumbnail(itemRecord),
        sourceTitle: feed.title,
        sourceUrl: feed.link,
      };
    });

    const response: FeedResponse = {
      title: feed.title || 'Unknown Feed',
      description: feed.description,
      link: feed.link,
      items,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('RSS fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch or parse RSS feed' },
      { status: 500 }
    );
  }
}
