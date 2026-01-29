import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/ai/providers';

export async function POST(req: NextRequest) {
    try {
        const {
            articles,
            aiSettings,
            telegramSettings
        } = await req.json();

        if (!articles || articles.length === 0) {
            return NextResponse.json({ error: 'No articles provided' }, { status: 400 });
        }

        // 1. Build the prompt for a global briefing
        const prompt = `You are a news analyst. Create a high-level briefing based on the following headlines from multiple sources.
Group them logically by topic. 
Be concise but informative. 
Use a friendly but professional tone (like J.A.R.V.I.S.).
Format with bold headers and bullet points.

Headlines:
${articles.map((a: any, i: number) => `${i + 1}. [${a.sourceTitle}] ${a.title}`).join('\n')}

Briefing:`;

        // 2. Generate the briefing
        const result = await generateText(
            aiSettings.provider,
            prompt,
            {
                apiKey: aiSettings.apiKey,
                baseUrl: aiSettings.ollamaUrl,
                model: aiSettings.model,
            }
        );
        const briefing = result.text;

        // 3. Push to Telegram if enabled and configured
        let telegramError = null;
        if (telegramSettings?.enabled && telegramSettings.token && telegramSettings.chatId) {
            const telegramUrl = `https://api.telegram.org/bot${telegramSettings.token}/sendMessage`;

            // Use Markdown formatting - Dynamic title based on time or generic
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
            
            const text = `${greeting} *${title}*\n\n${briefing}`;

            try {
                const res = await fetch(telegramUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: telegramSettings.chatId,
                        text: text,
                        parse_mode: 'Markdown',
                    }),
                });

                if (!res.ok) {
                    const errorDetails = await res.text();
                    console.error('Telegram push failed details:', errorDetails);
                    telegramError = `Telegram API Error: ${errorDetails}`;
                }
            } catch (err: any) {
                console.error('Telegram fetch catch:', err);
                telegramError = `Fetch Error: ${err.message}`;
            }
        }

        return NextResponse.json({ briefing, telegramError });
    } catch (error: any) {
        console.error('Briefing generation failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
