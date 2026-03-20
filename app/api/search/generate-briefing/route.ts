import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { generateText } from '@/lib/ai/providers';
import { getDb } from '@/lib/server/db';
import { getArticlesFromSavedSearchResults } from '@/lib/server/saved-search-results-repository';
import { getPersistedSettings, type PersistedSettings } from '@/lib/server/settings-repository';
import { getDefaultSettingsSnapshot } from '@/lib/settings-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { searchRuleId, briefingTitle } = body as {
      searchRuleId: string;
      briefingTitle?: string;
    };

    if (!searchRuleId) {
      return NextResponse.json({ error: 'Missing searchRuleId' }, { status: 400 });
    }

    // Get all articles from saved search results
    const articles = getArticlesFromSavedSearchResults(searchRuleId);

    if (!articles.length) {
      return NextResponse.json(
        { error: 'No saved results found for this search' },
        { status: 400 }
      );
    }

    // Get AI settings
    const settings = getPersistedSettings(getDefaultSettingsSnapshot());
    if (!settings.aiSettings.enabled) {
      return NextResponse.json(
        { error: 'AI features are not enabled' },
        { status: 400 }
      );
    }

    // Prepare article summaries for AI
    const articlesText = articles
      .slice(0, 20) // Limit to top 20 articles
      .map(
        (article, index) =>
          `${index + 1}. ${article.title}\nSource: ${article.sourceTitle || 'Unknown'}\n` +
          `Published: ${article.publishedAt || 'N/A'}\n` +
          `Snippet: ${article.contentSnippet || 'N/A'}`
      )
      .join('\n\n');

    const prompt = `You are a professional news briefing writer. Create a comprehensive briefing from the following search results.

Articles:
${articlesText}

Please generate:
1. An executive summary (2-3 sentences)
2. Key themes (4-6 bullet points highlighting main topics)
3. A formatted briefing in markdown

Format the response as JSON with fields: "executiveSummary", "keyThemes" (array), "briefingContent" (markdown)`;

    // Get model config
    const provider = settings.aiSettings.provider || 'anthropic';
    const model = settings.aiSettings.model || 'claude-3-5-sonnet-20241022';
    const apiKey = settings.aiSettings.apiKeys[provider];

    if (!apiKey) {
      return NextResponse.json(
        { error: `API key not configured for provider: ${provider}` },
        { status: 400 }
      );
    }

    // Generate briefing with AI
    const result = await generateText(
      provider as any,
      prompt,
      {
        model,
        apiKey,
        temperature: 0.7,
        maxTokens: 2000,
      }
    );

    // Parse AI response
    let parsedResponse;
    try {
      // Extract JSON from response (might be wrapped in markdown code blocks)
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      parsedResponse = JSON.parse(jsonMatch ? jsonMatch[0] : result.text);
    } catch (e) {
      // Fallback if parsing fails
      parsedResponse = {
        executiveSummary: result.text.substring(0, 300),
        keyThemes: ['Summary generated from search results'],
        briefingContent: result.text,
      };
    }

    // Save briefing to database
    const db = getDb();
    const briefingId = nanoid();
    const now = new Date().toISOString();
    const briefingDate = new Date().toISOString().split('T')[0];

    const topStories = articles.slice(0, 10).map((article) => ({
      articleId: article.id,
      title: article.title,
      url: article.url,
      sourceTitle: article.sourceTitle,
      category: article.sourceTitle,
    }));

    db.prepare(
      `
      INSERT INTO briefings (id, briefing_date, title, executive_summary, key_themes_json, top_stories_json, scope_json, created_at, model_provider, model_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      briefingId,
      briefingDate,
      briefingTitle || `Search Results Briefing - ${briefingDate}`,
      parsedResponse.executiveSummary,
      JSON.stringify(parsedResponse.keyThemes || []),
      JSON.stringify(topStories),
      JSON.stringify({ sourceType: 'search', searchRuleId }),
      now,
      provider,
      model
    );

    return NextResponse.json({
      success: true,
      briefingId,
      briefing: {
        id: briefingId,
        title: briefingTitle || `Search Results Briefing - ${briefingDate}`,
        executiveSummary: parsedResponse.executiveSummary,
        keyThemes: parsedResponse.keyThemes,
        briefingContent: parsedResponse.briefingContent,
        topStories,
        createdAt: now,
      },
    });
  } catch (error) {
    console.error('Error generating briefing from search:', error);
    return NextResponse.json(
      { error: 'Failed to generate briefing: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
