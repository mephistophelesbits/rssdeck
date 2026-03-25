import { NextRequest, NextResponse } from 'next/server';
import { reorderFeedListItems } from '@/lib/server/feed-lists-repository';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ listId: string }> }
) {
    try {
        const { listId } = await params;
        const body = await request.json() as { orderedFeedIds?: string[] };
        if (!body.orderedFeedIds || !Array.isArray(body.orderedFeedIds)) {
            return NextResponse.json({ error: 'Missing orderedFeedIds' }, { status: 400 });
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
