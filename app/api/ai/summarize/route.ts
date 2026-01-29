import { NextRequest, NextResponse } from 'next/server';
import { generateText, AIProvider } from '@/lib/ai/providers';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

interface RelatedSource {
  title: string;
  source: string;
  snippet: string;
  url?: string;
}

interface WebSource {
  title: string;
  snippet: string;
  url: string;
}

function buildSimplePrompt(title: string, content: string, language: string): string {
  const langInstruction = language === 'Original Language'
    ? "the EXACT SAME LANGUAGE as the original content. If it is in Chinese, you MUST summarize in Chinese. If it is in English, you MUST summarize in English."
    : language;

  return `Summarize the following news article in ${langInstruction}.
Keep it concise (maximum 3 bullet points).
Format the response as markdown bullet points.
Only output the bullet points, no introduction or conclusion.
CRITICAL: You MUST use the same language for the summary as the content provided below.

Title: ${title}
Content: ${content}
`;
}

function buildEnhancedPrompt(
  title: string,
  content: string,
  language: string,
  relatedArticles: RelatedSource[],
  webResults: WebSource[]
): string {
  const langInstruction = language === 'Original Language'
    ? "the EXACT SAME LANGUAGE as the main article. If the article is in Chinese, you MUST output the entire summary in Chinese. Do not use English if the article is Chinese."
    : language;

  let prompt = `You are a news analyst providing comprehensive summaries by cross-referencing multiple sources.

Analyze the following article along with related sources and provide an accurate, well-rounded summary in ${langInstruction}.

## MAIN ARTICLE
**Title:** ${title}
**Content:** ${content}
`;

  if (relatedArticles.length > 0) {
    prompt += `
## RELATED ARTICLES FROM USER'S NEWS FEEDS
${relatedArticles.map((a, i) => `${i + 1}. **${a.title}** (${a.source})
   ${a.snippet}`).join('\n\n')}
`;
  }

  if (webResults.length > 0) {
    prompt += `
## ADDITIONAL WEB SOURCES
${webResults.map((w, i) => `${i + 1}. **${w.title}**
   ${w.snippet}`).join('\n\n')}
`;
  }

  prompt += `
## YOUR TASK
Provide a comprehensive summary with the following sections:

### Key Facts
- List 3-4 main facts from the story, verified across sources where possible

### Perspectives
- Note any different angles or viewpoints from different sources (if applicable)

### Source Overview
- Briefly note how many sources covered this topic and any notable differences

Format as markdown. Be accurate and concise.
CRITICAL: You MUST use the same language for the summary as the Main Article provided above. Do not translate it to English if the article is in another language.`;

  return prompt;
}

export async function POST(req: NextRequest) {
  try {
    const {
      content,
      title,
      model,
      language,
      provider = 'ollama',
      apiKey,
      ollamaUrl,
      enhancedMode,
      relatedArticles,
      webResults
    } = await req.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const selectedModel = model || (provider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini');
    const lang = language || 'English';

    // Build prompt based on mode
    const prompt = enhancedMode
      ? buildEnhancedPrompt(title, content, lang, relatedArticles || [], webResults || [])
      : buildSimplePrompt(title, content, lang);

    const result = await generateText(provider as AIProvider, prompt, {
      model: selectedModel,
      apiKey,
      baseUrl: ollamaUrl || DEFAULT_OLLAMA_URL,
    });

    return NextResponse.json({
      summary: result.text,
      enhancedMode: !!enhancedMode,
      sourcesUsed: enhancedMode ? {
        relatedArticles: relatedArticles?.length || 0,
        webResults: webResults?.length || 0,
      } : undefined,
    });
  } catch (error: any) {
    console.error('AI Summary Error:', error);

    // Check if it's a connection error for Ollama
    if (error.message?.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Cannot connect to Ollama. Make sure Ollama is running (ollama serve).' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to generate summary' },
      { status: 500 }
    );
  }
}

// GET endpoint to check available models
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ollamaUrl = searchParams.get('ollamaUrl') || DEFAULT_OLLAMA_URL;

    const response = await fetch(`${ollamaUrl}/api/tags`);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch models from Ollama' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const models = data.models?.map((m: any) => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at,
    })) || [];

    return NextResponse.json({ models, connected: true });
  } catch (error: any) {
    return NextResponse.json(
      { models: [], connected: false, error: 'Ollama not running' },
      { status: 200 }
    );
  }
}
