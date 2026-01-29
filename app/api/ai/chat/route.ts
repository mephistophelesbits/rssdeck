import { NextRequest, NextResponse } from 'next/server';
import { generateChat, AIProvider, AIChatMessage } from '@/lib/ai/providers';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

interface ChatRequest {
  messages: AIChatMessage[];
  articleContext: {
    title: string;
    content: string;
    source?: string;
    url?: string;
  };
  model?: string;
  provider?: string;
  apiKey?: string;
  ollamaUrl?: string;
  searchWeb?: boolean;
  searchQuery?: string;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function searchWeb(query: string): Promise<WebSearchResult[]> {
  try {
    // Use the existing web-search endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/web-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, maxResults: 5 }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.results || [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const {
      messages,
      articleContext,
      model,
      provider = 'ollama',
      apiKey,
      ollamaUrl,
      searchWeb: shouldSearch,
      searchQuery
    } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      );
    }

    if (!articleContext || !articleContext.title) {
      return NextResponse.json(
        { error: 'Article context is required' },
        { status: 400 }
      );
    }

    const selectedModel = model || (provider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini');

    // Optionally search the web for additional context
    let webResults: WebSearchResult[] = [];
    if (shouldSearch && searchQuery) {
      webResults = await searchWeb(searchQuery);
    }

    // Build the system prompt
    const systemPrompt = `You are a helpful AI assistant discussing a news article with the user. Be concise and informative.

## ARTICLE CONTEXT
**Title:** ${articleContext.title}
**Source:** ${articleContext.source || 'Unknown'}
**Content:** ${articleContext.content.slice(0, 3000)}${articleContext.content.length > 3000 ? '...' : ''}
${webResults.length > 0 ? `
## WEB SEARCH RESULTS (use these to answer the user's question)
${webResults.map((r, i) => `${i + 1}. **${r.title}**
   ${r.snippet}
   Source: ${r.url}`).join('\n\n')}
` : ''}`;

    const fullMessages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const result = await generateChat(provider as AIProvider, fullMessages, {
      model: selectedModel,
      apiKey,
      baseUrl: ollamaUrl || DEFAULT_OLLAMA_URL,
    });

    return NextResponse.json({
      reply: result.text.trim(),
      webResultsUsed: webResults.length > 0,
      webResults: webResults.length > 0 ? webResults : undefined,
    });
  } catch (error: any) {
    console.error('Chat AI Error:', error);

    // Check if it's a connection error for Ollama
    if (error.message?.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Cannot connect to Ollama. Make sure Ollama is running (ollama serve).' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to generate response' },
      { status: 500 }
    );
  }
}
