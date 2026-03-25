import { NextRequest, NextResponse } from 'next/server';
import { addFeedToList } from '@/lib/server/feed-lists-repository';
import { nanoid } from 'nanoid';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ listId: string }> }
) {
    try {
        const { listId } = await params;
        const body = await request.json() as { url?: string; title?: string };
        if (!body.url?.trim()) {
            return NextResponse.json({ error: 'Missing url' }, { status: 400 });
        }

        const feed = {
            id: nanoid(),
            url: body.url.trim(),
            title: body.title?.trim() || body.url.trim(),
        };

        return NextResponse.json(addFeedToList(listId, feed));
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to add feed to list' },
            { status: 500 },
        );
    }
}
