import { NextRequest, NextResponse } from 'next/server';
import { removeFeedFromList } from '@/lib/server/feed-lists-repository';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ listId: string; feedId: string }> }
) {
    try {
        const { listId, feedId } = await params;
        removeFeedFromList(listId, feedId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to remove feed from list' },
            { status: 500 },
        );
    }
}
