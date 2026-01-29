import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display, Orbitron } from 'next/font/google';
import './globals.css';

const orbitron = Orbitron({
  variable: '--font-orbitron',
  subsets: ['latin'],
  display: 'swap',
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
});

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RSS Deck - Curated Feeds',
  description: 'A beautiful, organized way to read your favorite feeds.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${playfair.variable} ${orbitron.variable} antialiased h-screen overflow-hidden bg-background text-foreground font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
