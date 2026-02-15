import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/ai/providers';

// Stock watchlist (6 stocks)
const STOCK_WATCHLIST = ['1815.HK', '5099.KL', '5238.KL', 'ARKK', 'MAGS', 'NVDA'];

async function fetchStockPrice(symbol: string): Promise<any> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=60d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    
    const meta = result.meta;
    const close = result.indicators.quote[0].close || [];
    const prices = close.slice(-50).filter((p: any) => p !== null);
    
    return {
      symbol,
      currentPrice: meta.regularMarketPrice,
      prices
    };
  } catch {
    return null;
  }
}

function calculateSMA(prices: number[], period: number): number {
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calculateRSI(prices: number[], period: number = 14): number {
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  const gains = changes.slice(-period).filter(c => c > 0);
  const losses = changes.slice(-period).filter(c => c < 0).map(c => Math.abs(c));
  
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calculateMACD(prices: number[]) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  return { macdLine: ema12 - ema26 };
}

function calculateEMA(prices: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function analyzeStock(data: any): any {
  if (!data || data.prices.length < 50) return null;
  
  const prices = data.prices;
  const currentPrice = data.currentPrice;
  const sma20 = calculateSMA(prices, 20);
  const sma50 = calculateSMA(prices, 50);
  const rsi = calculateRSI(prices);
  const { macdLine } = calculateMACD(prices);
  
  // Calculate support/resistance
  const recentPrices = prices.slice(-20);
  const support = Math.min(...recentPrices);
  const resistance = Math.max(...recentPrices);
  
  // Determine recommendation
  let bullish = 0;
  let bearish = 0;
  const signals: string[] = [];
  
  if (currentPrice > sma50) { bullish++; signals.push('Above SMA50'); }
  else { bearish++; signals.push('Below SMA50'); }
  
  if (currentPrice > sma20) { bullish++; signals.push('Above SMA20'); }
  else { bearish++; signals.push('Below SMA20'); }
  
  if (rsi < 35) { bullish++; signals.push('RSI Oversold'); }
  else if (rsi > 65) { bearish++; signals.push('RSI Overbought'); }
  
  if (macdLine > 0) { bullish++; signals.push('MACD Bullish'); }
  else { bearish++; signals.push('MACD Bearish'); }
  
  let recommendation = 'HOLD';
  if (bullish >= 3) recommendation = 'BUY 🟢';
  else if (bearish >= 3) recommendation = 'SELL 🔴';
  
  // Calculate targets
  const stop = recommendation === 'BUY' ? support * 0.95 : resistance * 1.05;
  const target = recommendation === 'BUY' ? resistance * 0.98 : support * 1.02;
  const riskReward = Math.abs((target - currentPrice) / (currentPrice - stop));
  
  return {
    symbol: data.symbol,
    price: currentPrice.toFixed(2),
    sma20: sma20.toFixed(2),
    sma50: sma50.toFixed(2),
    rsi: rsi.toFixed(1),
    recommendation,
    entry: currentPrice.toFixed(2),
    stop: stop.toFixed(2),
    target: target.toFixed(2),
    riskReward: riskReward.toFixed(1),
    confidence: bullish >= 3 ? 'HIGH' : bearish >= 3 ? 'HIGH' : 'MEDIUM',
    signals: signals.join(', ')
  };
}

export async function POST(req: NextRequest) {
  try {
    const {
      articles,
      aiSettings,
      telegramSettings,
      includeStocks = true
    } = await req.json();

    // Generate news briefing
    let briefing = '';
    if (articles && articles.length > 0) {
      const prompt = `You are a news analyst. Create a concise briefing from these headlines. Use bold headers and bullet points. Keep it brief.\n\nHeadlines:\n${articles.map((a: any, i: number) => `${i + 1}. ${a.title}`).join('\n')}\n\nBriefing:`;
      
      const result = await generateText(
        aiSettings?.provider || 'ollama',
        prompt,
        {
          apiKey: aiSettings?.apiKey,
          baseUrl: aiSettings?.ollamaUrl,
          model: aiSettings?.model || 'llama3.2',
        }
      );
      briefing = result.text;
    }

    // Generate stock signals
    let stockSignals: any[] = [];
    if (includeStocks) {
      const stocks = await Promise.all(
        STOCK_WATCHLIST.map(s => fetchStockPrice(s))
      );
      stockSignals = stocks
        .map(data => analyzeStock(data))
        .filter(s => s !== null && s.recommendation !== 'HOLD')
        .slice(0, 5); // Top 5 signals only
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
    
    let message = `${greeting} *${title}*\n\n`;
    
    if (briefing) {
      message += `${briefing}\n\n`;
    }
    
    if (stockSignals.length > 0) {
      message += `📊 *STOCK SIGNALS* \\| Mid\\-Term Setup\\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\\n`;
      
      stockSignals.forEach(s => {
        message += `${s.recommendation} *${s.symbol}* \\- $${s.price}\\n`;
        message += `🎯 Entry: \\$${s.entry} | 🛑 Stop: \\$${s.stop} | 📈 Target: \\$${s.target}\\n`;
        message += `⚖️ R:R *1:${s.riskReward}* | Conf: ${s.confidence}\\n`;
        message += `────────────────────\\n`;
      });
      
      message += `_Only buy if 2\\+ indicators agree. Ride 2\\+ weeks minimum._\\n\\n`;
    }
    
    message += `_Generated at ${new Date().toLocaleTimeString()}_`;

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
            parse_mode: 'MarkdownV2'
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
      stockSignals,
      message,
      telegramError,
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    console.error('Briefing failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
