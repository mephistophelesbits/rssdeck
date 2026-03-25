import { NextRequest, NextResponse } from 'next/server';
import { createFeedList, getFeedLists } from '@/lib/server/feed-lists-repository';

export async function GET() {
    try {
        return NextResponse.json(getFeedLists());
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to get feed lists' },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as { name?: string };
        if (!body.name?.trim()) {
            return NextResponse.json({ error: 'Missing name' }, { status: 400 });
        }

        return NextResponse.json(createFeedList(body.name));
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create feed list' },
            { status: 500 },
        );
    }
}
