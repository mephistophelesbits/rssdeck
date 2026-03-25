import { NextRequest, NextResponse } from 'next/server';
import { deleteFeedList, getFeedListById, renameFeedList } from '@/lib/server/feed-lists-repository';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ listId: string }> }
) {
    try {
        const { listId } = await params;
        const list = getFeedListById(listId);
        if (!list) {
            return NextResponse.json({ error: 'List not found' }, { status: 404 });
        }
        return NextResponse.json(list);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to get feed list' },
            { status: 500 },
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ listId: string }> }
) {
    try {
        const { listId } = await params;
        const body = await request.json() as { name?: string };
        if (!body.name?.trim()) {
            return NextResponse.json({ error: 'Missing name' }, { status: 400 });
        }

        return NextResponse.json(renameFeedList(listId, body.name));
    } catch (error) {
        if (error instanceof Error && error.message === 'List not found') {
            return NextResponse.json({ error: 'List not found' }, { status: 404 });
        }
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to rename feed list' },
            { status: 500 },
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ listId: string }> }
) {
    try {
        const { listId } = await params;
        deleteFeedList(listId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'IN_USE') {
            return NextResponse.json(
                { error: error.message, code: 'IN_USE' },
                { status: 409 },
            );
        }
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete feed list' },
            { status: 500 },
        );
    }
}
