import { NextResponse } from 'next/server';
import { getDeckState } from '@/lib/server/deck-repository';
import { generateOPML, OPMLFeed } from '@/lib/opml';

export async function GET() {
  const { columns } = getDeckState();

  const feeds: OPMLFeed[] = columns.flatMap((column) =>
    column.sources.map((source) => ({
      title: source.title,
      url: source.url,
      category: column.title,
    }))
  );

  const body = generateOPML(feeds, 'RSS Deck Feed Export');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/x-opml; charset=utf-8',
      'Content-Disposition': 'attachment; filename="rssdeck-feeds.opml"',
    },
  });
}
