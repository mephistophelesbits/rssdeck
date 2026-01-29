import { NextRequest, NextResponse } from 'next/server';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

interface ScrapedArticle {
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
  byline: string | null;
  siteName: string | null;
  length: number;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    // Fetch the article page
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch article: ${response.status}`);
      }

      const html = await response.text();

      // Parse with JSDOM and Readability
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article) {
        return NextResponse.json(
          { error: 'Could not extract article content. The page may not be a standard article.' },
          { status: 422 }
        );
      }

      const result: ScrapedArticle = {
        title: article.title || '',
        content: article.content || '',
        textContent: article.textContent || '',
        excerpt: article.excerpt || '',
        byline: article.byline || null,
        siteName: article.siteName || null,
        length: article.length || 0,
      };

      return NextResponse.json({
        success: true,
        article: result,
      });

    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timed out. The article page took too long to load.' },
          { status: 504 }
        );
      }

      throw fetchError;
    }

  } catch (error: any) {
    console.error('Scrape error:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to scrape article' },
      { status: 500 }
    );
  }
}
