import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'RSS Deck — AI-Powered RSS Reader',
  description: 'TweetDeck-style RSS reader with local AI summarization. Self-host or cloud.',
};

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f0f23', color: '#fff', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
        <header style={{ textAlign: 'center', marginBottom: 60 }}>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #00d4ff, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 16 }}>
            RSS Deck
          </h1>
          <p style={{ fontSize: '1.5rem', color: '#94a3b8', marginBottom: 40 }}>
            AI-Powered RSS Reader — Your Personal News Command Center
          </p>
          <Link href="/" style={{ display: 'inline-block', background: 'linear-gradient(135deg, #00d4ff, #7c3aed)', color: 'white', padding: '16px 40px', borderRadius: 50, textDecoration: 'none', fontWeight: 600, fontSize: '1.1rem', marginBottom: 40 }}>
            Try Live Demo →
          </Link>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24, marginBottom: 60 }}>
          {[
            { title: '🤖 Local AI Summarization', desc: 'Articles summarized using your own Ollama instance. No data leaves your machine.' },
            { title: '📱 TweetDeck-Style Layout', desc: 'Multi-column view for different topics. Organize feeds by category or source.' },
            { title: '🌙 Dark Mode Built-in', desc: '8 themes including Cyberpunk, J.A.R.V.I.S., Matrix, and more.' },
            { title: '📊 Stock Ticker', desc: 'Real-time portfolio tracking with AI-generated trading signals.' },
            { title: '🔔 Telegram Briefings', desc: 'Daily AI-curated news briefings delivered to your Telegram.' },
            { title: '☁️ Or Cloud-Hosted', desc: 'Host yourself or use the cloud version. Your data, your choice.' },
          ].map((f, i) => (
            <div key={i} style={{ background: '#1a1a2e', padding: 30, borderRadius: 16, border: '1px solid #2d2d4a' }}>
              <h3 style={{ color: '#00d4ff', marginBottom: 12, fontSize: '1.2rem' }}>{f.title}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>{f.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ background: '#1a1a2e', padding: 30, borderRadius: 16, border: '1px solid #2d2d4a', marginBottom: 40 }}>
          <h2 style={{ color: '#00d4ff', marginBottom: 16 }}>🚀 Quick Deploy (Docker)</h2>
          <pre style={{ background: '#0f0f23', padding: 20, borderRadius: 12, overflow: 'auto', fontSize: '0.9rem', color: '#22c55e', border: '1px solid #2d2d4a' }}>
{`# One-line deploy:
docker run -d -p 3000:3000 -v rss-data:/app/data --name rssdeck kianfong/rssdeck:latest

# Or with docker-compose:
curl -sL https://raw.githubusercontent.com/mephistophelesbits/rssdeck/main/docker-compose.yml | docker-compose up -d`}
          </pre>
        </div>

        <div style={{ textAlign: 'center', padding: 40, background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.1))', borderRadius: 16, border: '1px solid #2d2d4a' }}>
          <h2 style={{ marginBottom: 16 }}>Open Source. Free Forever.</h2>
          <p style={{ color: '#94a3b8', marginBottom: 24 }}>Built with ❤️ for the RSS community</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="https://github.com/mephistophelesbits/rssdeck" target="_blank" style={{ color: '#00d4ff', textDecoration: 'none', padding: '10px 20px', border: '1px solid #00d4ff', borderRadius: 8 }}>GitHub</a>
            <a href="https://rssdeck.vercel.app" target="_blank" style={{ color: '#00d4ff', textDecoration: 'none', padding: '10px 20px', border: '1px solid #00d4ff', borderRadius: 8 }}>Live Demo</a>
            <a href="https://hub.docker.com/r/kianfong/rssdeck" target="_blank" style={{ color: '#00d4ff', textDecoration: 'none', padding: '10px 20px', border: '1px solid #00d4ff', borderRadius: 8 }}>Docker Hub</a>
          </div>
        </div>

        <footer style={{ textAlign: 'center', marginTop: 60, color: '#6b7280', fontSize: '0.9rem' }}>
          <p>RSS Deck © 2026 — Made with ☕ and AI</p>
        </footer>
      </div>
    </div>
  );
}
