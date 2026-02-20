import { NextRequest, NextResponse } from 'next/server';
import { generateText, AIProvider } from '@/lib/ai/providers';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

type TaskType = 'summarize' | 'sentiment' | 'translate';
type SentimentResult = 'Positive' | 'Negative' | 'Neutral';

interface AIRequest {
  task: TaskType;
  content: string;
  title?: string;
  model?: string;
  provider?: string;
  apiKey?: string;
  language?: string;
  targetLanguage?: string;
  ollamaUrl?: string;
}

function buildTranslatePrompt(content: string, targetLanguage: string): string {
  return `Translate the following text to ${targetLanguage}.
Only output the translated text. No other commentary or explanations.

Text:
${content}`;
}

function buildSummarizePrompt(title: string, content: string, language: string): string {
  const langInstruction = language === 'Original Language'
    ? "the EXACT SAME LANGUAGE as the original content. If it is in Chinese, you MUST summarize in Chinese. If it is in English, you MUST summarize in English."
    : language;

  return `Summarize the following article in ${langInstruction}.
Keep it concise (maximum 3 bullet points).
Format the response as markdown bullet points.
Only output the bullet points, no introduction or conclusion.
CRITICAL: You MUST use the same language for the summary as the content provided below. Do not translate to English if the content is in another language.

Title: ${title}
Content: ${content}
`;
}

function buildSentimentPrompt(headline: string): string {
  return `Classify the sentiment of this headline as 'Positive', 'Negative', or 'Neutral'.
Return ONLY one word: Positive, Negative, or Neutral.
Do not include any other text, explanation, or punctuation.

Headline: ${headline}`;
}

function parseSentimentResponse(response: string): SentimentResult {
  const cleaned = response.trim().toLowerCase();
  if (cleaned.includes('positive')) return 'Positive';
  if (cleaned.includes('negative')) return 'Negative';
  return 'Neutral';
}

export async function POST(req: NextRequest) {
  try {
    const body: AIRequest = await req.json();
    const {
      task,
      content,
      title,
      model,
      provider = 'ollama',
      apiKey,
      language,
      ollamaUrl,
      customSummaryPrompt
    } = body as any; // Cast as any since we added customSummaryPrompt

    if (!task || !content) {
      return NextResponse.json(
        { error: 'Both "task" and "content" are required' },
        { status: 400 }
      );
    }

    if (task !== 'summarize' && task !== 'sentiment' && task !== 'translate') {
      return NextResponse.json(
        { error: 'Task must be "summarize", "sentiment", or "translate"' },
        { status: 400 }
      );
    }

    const selectedModel = model || (provider === 'ollama' ? 'llama3.2' : 'gpt-4.1');
    const lang = language || 'English';

    // Build prompt based on task
    let prompt: string;
    if (task === 'summarize') {
      if (customSummaryPrompt && customSummaryPrompt.trim().length > 0) {
        prompt = customSummaryPrompt.replace('{{content}}', content).replace('{{title}}', title || '');
        if (!prompt.includes(content)) {
          prompt += `\n\nTitle: ${title}\nContent: ${content}`;
        }
      } else {
        prompt = buildSummarizePrompt(title || '', content, lang);
      }
    } else if (task === 'translate') {
      prompt = buildTranslatePrompt(content, body.targetLanguage || 'Chinese');
    } else {
      prompt = buildSentimentPrompt(content);
    }

    const result = await generateText(provider as AIProvider, prompt, {
      model: selectedModel,
      apiKey,
      baseUrl: ollamaUrl || DEFAULT_OLLAMA_URL,
    });

    const rawResponse = result.text;

    // Parse response based on task
    if (task === 'summarize') {
      return NextResponse.json({
        task: 'summarize',
        summary: rawResponse || 'Failed to generate summary.',
      });
    } else if (task === 'translate') {
      return NextResponse.json({
        task: 'translate',
        translation: rawResponse || 'Failed to translate.',
      });
    } else {
      const sentiment = parseSentimentResponse(rawResponse);
      return NextResponse.json({
        task: 'sentiment',
        sentiment: sentiment,
        raw: rawResponse.trim(),
      });
    }
  } catch (error: any) {
    console.error('AI API Error:', error);

    // Check if it's a connection error for Ollama
    if (error.message?.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Cannot connect to Ollama. Make sure Ollama is running (ollama serve).' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to process AI request' },
      { status: 500 }
    );
  }
}

// GET endpoint to check Ollama status
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ollamaUrl = searchParams.get('ollamaUrl') || DEFAULT_OLLAMA_URL;

    const response = await fetch(`${ollamaUrl}/api/tags`);

    if (!response.ok) {
      return NextResponse.json(
        { connected: false, error: 'Failed to connect to Ollama' },
        { status: 200 }
      );
    }

    const data = await response.json();
    const models = data.models?.map((m: any) => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at,
    })) || [];

    return NextResponse.json({
      connected: true,
      models,
      message: 'Ollama is running'
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        connected: false,
        models: [],
        error: 'Ollama not running. Start it with: ollama serve'
      },
      { status: 200 }
    );
  }
}
