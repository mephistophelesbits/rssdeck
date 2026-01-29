'use client';

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/lib/settings-store';
import { useDeckStore } from '@/lib/store';
import { useArticlesStore } from '@/lib/articles-store';

export function BriefingManager() {
    const { briefingSettings, setBriefingSettings, aiSettings } = useSettingsStore();
    const columns = useDeckStore((state) => state.columns);
    const articlesByColumn = useArticlesStore((state) => state.articlesByColumn);

    const isGeneratingRef = useRef(false);

    useEffect(() => {
        if (!briefingSettings.enabled) return;

        const checkBriefing = async () => {
            if (isGeneratingRef.current) return;

            const now = new Date();
            const lastGenerated = briefingSettings.lastGenerated ? new Date(briefingSettings.lastGenerated) : null;

            // Find the latest scheduled time that is in the past
            let latestTargetTime: Date | null = null;

            for (const timeStr of briefingSettings.times) {
                const [hour, minute] = timeStr.split(':').map(Number);
                const targetTime = new Date();
                targetTime.setHours(hour, minute, 0, 0);

                if (now >= targetTime) {
                    // Determine the most recent valid trigger for this specific time slot
                    // (It's today's slot since we setHours on new Date())
                    if (!latestTargetTime || targetTime > latestTargetTime) {
                        latestTargetTime = targetTime;
                    }
                }
            }

            if (!latestTargetTime) return; // No scheduled times have passed today

            // If we have generated after the latest target time, do nothing
            if (lastGenerated && lastGenerated >= latestTargetTime) {
                // Special case: if last generated was yesterday, but latestTargetTime is today
                // If lastGenerated is essentially "older" than the target trigger
                // But simple check: if lastGenerated is AFTER the target timestamp, we are good.
                // Since latestTargetTime is Today X:Y, and lastGenerated could be Today Z:W.
                return;
            }

            // Double check: if lastGenerated was yesterday, it is definitely < latestTargetTime (today)
            // So we proceed.

            // Start generation check
            // We only want to auto-generate if we haven't done so for this slot.

            // Start generation
            isGeneratingRef.current = true;
            console.log('Generating Morning Briefing...');

            try {
                // Collect top articles from all columns
                const allTopArticles: any[] = [];
                columns.forEach(col => {
                    const colArticles = articlesByColumn.get(col.id) || [];
                    // Take top 3 from each column
                    allTopArticles.push(...colArticles.slice(0, 3));
                });

                if (allTopArticles.length === 0) {
                    console.log('No articles found for briefing.');
                    isGeneratingRef.current = false;
                    return;
                }

                // Call briefing API
                const response = await fetch('/api/ai/briefing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        articles: allTopArticles.map(a => ({
                            title: a.title,
                            sourceTitle: a.sourceTitle
                        })),
                        aiSettings,
                        telegramSettings: {
                            enabled: briefingSettings.telegramEnabled,
                            token: briefingSettings.telegramToken,
                            chatId: briefingSettings.telegramChatId
                        }
                    }),
                });

                if (response.ok) {
                    console.log('Morning Briefing generated successfully!');
                    setBriefingSettings({ lastGenerated: now.toISOString() });
                } else {
                    console.error('Failed to generate briefing:', await response.text());
                }
            } catch (error) {
                console.error('Error in BriefingManager:', error);
            } finally {
                isGeneratingRef.current = false;
            }
        };

        // Check every minute
        const interval = setInterval(checkBriefing, 60000);
        // Also check immediately
        checkBriefing();

        return () => clearInterval(interval);
    }, [briefingSettings, columns, articlesByColumn, aiSettings, setBriefingSettings]);

    return null; // This is a logic-only component
}
