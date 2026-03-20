import { NextRequest, NextResponse } from 'next/server';
import { saveSearchResults, getSavedResultsByRuleId } from '@/lib/server/saved-search-results-repository';
import type { SearchResult } from '@/lib/server/search-repository';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { searchRuleId, results } = body as {
      searchRuleId: string;
      results: SearchResult[];
    };

    if (!searchRuleId) {
      return NextResponse.json({ error: 'Missing searchRuleId' }, { status: 400 });
    }

    if (!Array.isArray(results) || !results.length) {
      return NextResponse.json({ error: 'No results to save' }, { status: 400 });
    }

    const savedResults = saveSearchResults(
      results.map((article) => ({
        searchRuleId,
        article,
      }))
    );

    return NextResponse.json({ success: true, count: savedResults.length, savedResults });
  } catch (error) {
    console.error('Error saving search results:', error);
    return NextResponse.json({ error: 'Failed to save results' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const searchRuleId = searchParams.get('ruleId');

    if (!searchRuleId) {
      return NextResponse.json({ error: 'Missing ruleId parameter' }, { status: 400 });
    }

    const savedResults = getSavedResultsByRuleId(searchRuleId);

    return NextResponse.json({ savedResults });
  } catch (error) {
    console.error('Error fetching saved search results:', error);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}
