import { NextRequest, NextResponse } from 'next/server';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface WebSearchResponse {
  results: WebSearchResult[];
  query: string;
}

/**
 * Parse DuckDuckGo HTML search results
 */
function parseSearchResults(html: string, maxResults: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];

  // DuckDuckGo HTML results are typically in div.result or similar structure
  // We use a more generic approach to match titles and links

  // Try to match result titles and links
  // Format: <a class="result__a" href="...">Title</a>
  const resultRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  const titleMatches = [...html.matchAll(resultRegex)];
  const snippetMatches = [...html.matchAll(snippetRegex)];

  for (let i = 0; i < Math.min(titleMatches.length, maxResults); i++) {
    const titleMatch = titleMatches[i];
    const snippetMatch = snippetMatches[i];

    if (titleMatch) {
      let url = titleMatch[1];
      let title = titleMatch[2].replace(/<[^>]*>/g, '').trim();
      title = decodeHTMLEntities(title);

      // DuckDuckGo use redirect URLs, extract actual URL if present
      if (url.includes('uddg=')) {
        try {
          const urlObj = new URL('https://duckduckgo.com' + url);
          const uddg = urlObj.searchParams.get('uddg');
          if (uddg) url = decodeURIComponent(uddg);
        } catch (e) {
          const uddgMatch = url.match(/uddg=([^&]*)/);
          if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
        }
      }

      // Clean up snippet (remove HTML tags)
      let snippet = '';
      if (snippetMatch) {
        snippet = decodeHTMLEntities(
          snippetMatch[1].replace(/<[^>]*>/g, '').trim()
        );
      }

      if (url && title && !url.startsWith('/')) {
        results.push({ title, url, snippet });
      }
    }
  }

  return results;
}

/**
 * Decode HTML entities
 */
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&hellip;': '...',
    '&mdash;': '-',
    '&ndash;': '-',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  result = result.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { query, maxResults = 5 } = await req.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Try DuckDuckGo first
    let searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      let response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://duckduckgo.com/',
        },
        signal: controller.signal,
      });

      // Handle DuckDuckGo's "html.duckduckgo.com" redirect if it happens
      if (response.status === 302 || response.status === 301) {
        const nextUrl = response.headers.get('location');
        if (nextUrl) {
          response = await fetch(nextUrl.startsWith('http') ? nextUrl : `https://duckduckgo.com${nextUrl}`, {
            headers: { 'User-Agent': userAgent },
            signal: controller.signal
          });
        }
      }

      if (response.ok) {
        const html = await response.text();
        const results = parseSearchResults(html, maxResults);

        if (results.length > 0) {
          clearTimeout(timeoutId);
          return NextResponse.json({ results, query });
        }
      }

      // Fallback to Mojeek if DuckDuckGo fails or returns no results
      const mojeekUrl = `https://www.mojeek.com/search?q=${encodeURIComponent(query)}`;
      const mojeekRes = await fetch(mojeekUrl, {
        headers: { 'User-Agent': userAgent },
        signal: controller.signal
      });

      if (mojeekRes.ok) {
        const mojeekHtml = await mojeekRes.text();
        // Basic Mojeek parsing
        const mojeekResults: WebSearchResult[] = [];
        const mojeekRegex = /<a class="title" [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<p class="s">([\s\S]*?)<\/p>/gi;
        const matches = [...mojeekHtml.matchAll(mojeekRegex)];

        for (const m of matches) {
          if (mojeekResults.length >= maxResults) break;
          mojeekResults.push({
            url: m[1],
            title: m[2].replace(/<[^>]*>/g, '').trim(),
            snippet: m[4].replace(/<[^>]*>/g, '').trim(),
          });
        }

        if (mojeekResults.length > 0) {
          clearTimeout(timeoutId);
          return NextResponse.json({ results: mojeekResults, query });
        }
      }

    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        // Timeout - return empty results gracefully
        return NextResponse.json({
          results: [],
          query,
          error: 'Search timed out',
        });
      }

      throw fetchError;
    }

  } catch (error: any) {
    console.error('Web search error:', error);

    // Return empty results instead of error (graceful degradation)
    return NextResponse.json({
      results: [],
      query: '',
      error: error.message || 'Search failed',
    });
  }
}
