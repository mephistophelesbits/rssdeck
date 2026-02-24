import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/ai/providers';



function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const {
      articles,
      aiSettings,
      telegramSettings,
      briefingSettings
    } = await req.json();

    // Generate news briefing
    let briefing = '';
    if (articles && articles.length > 0) {
      const articlesText = articles.map((a: any, i: number) => `${i + 1}. ${a.title}`).join('\n');
      let prompt = '';
      let systemPrompt: string | undefined;

      if (briefingSettings?.customPrompt && briefingSettings.customPrompt.trim().length > 0) {
        prompt = briefingSettings.customPrompt.replace('{{articles}}', articlesText);
        if (!prompt.includes(articlesText)) {
          prompt += `\n\nArticles:\n${articlesText}`;
        }
      } else {
        systemPrompt = `You are a News Intelligence Officer. Your sole job is to produce concise, structured daily news briefings from a list of headlines. Always follow the requested output format exactly. Do not add any preamble, sign-off, or extra commentary beyond what is specified.`;

        prompt = `Analyze the following headlines and produce today's briefing.

Instructions:
1. Select the 3-5 most important or time-sensitive developments as STRATEGIC HEADLINES.
2. Group the remaining headlines into key topics and write a one-line TOPIC SUMMARY for each group.

Output format (follow this exactly):

**🚨 STRATEGIC HEADLINES**
- **Headline text here**: One-line explanation of why it matters.

**📂 TOPIC SUMMARIES**
- **Topic Category**: Concise summary of the related developments in this group.

Headlines:
${articlesText}`;
      }

      const result = await generateText(
        aiSettings?.provider || 'ollama',
        prompt,
        {
          apiKey: aiSettings?.apiKeys?.[aiSettings?.provider] || aiSettings?.apiKey,
          baseUrl: aiSettings?.ollamaUrl,
          model: aiSettings?.model || 'llama3.2',
          systemPrompt,
          temperature: 0.3,
          maxTokens: 1024,
        }
      );
      briefing = result.text;
    }



    // Build Telegram message
    const hour = new Date().getHours();
    let greeting = '🌅';
    let title = 'DAILY BRIEFING';

    if (hour >= 12 && hour < 17) {
      greeting = '☀️';
      title = 'AFTERNOON BRIEFING';
    } else if (hour >= 17 || hour < 5) {
      greeting = '🌙';
      title = 'EVENING BRIEFING';
    }

    let message = `${greeting} <b>${title}</b>\n\n`;

    if (briefing) {
      // Escape HTML chars first, then convert Markdown bold to HTML bold
      const safeBriefing = escapeHtml(briefing)
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // **bold** -> <b>bold</b>
        .replace(/^\s*[-*]\s+/gm, '• ');        // List items -> Bullet points

      message += `${safeBriefing}\n\n`;
    }



    message += `<i>Generated at ${new Date().toLocaleTimeString()}</i>`;

    // Push to Telegram
    let telegramError = null;
    if (telegramSettings?.enabled && telegramSettings.token && telegramSettings.chatId) {
      const telegramUrl = `https://api.telegram.org/bot${telegramSettings.token}/sendMessage`;

      try {
        const res = await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramSettings.chatId,
            text: message,
            parse_mode: 'HTML'
          }),
        });

        if (!res.ok) {
          telegramError = await res.text();
        }
      } catch (err: any) {
        telegramError = err.message;
      }
    }

    return NextResponse.json({
      briefing,
      message,
      telegramError,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Briefing failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
