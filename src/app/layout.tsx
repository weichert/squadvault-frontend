// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s · SquadVault',
    default: 'SquadVault — Your League\'s Permanent Record',
  },
  description: 'The Clubhouse where your league\'s verified history lives.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://squadvault.com'),
  openGraph: {
    type: 'website',
    siteName: 'SquadVault',
  },
};

export const viewport: Viewport = {
  // Explicit mobile viewport (R3-D4): the A/V Room ingest tool is load-bearing for the
  // Draft Weekend capture->upload flow from a phone, so device-width / initial-scale 1
  // is stated here rather than left to a framework default.
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    // Gold on archive surfaces; dark on approval UX
    { media: '(prefers-color-scheme: dark)', color: '#C9A84C' },
    { media: '(prefers-color-scheme: light)', color: '#0B0B0E' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA manifest — dynamically generated per league, static fallback here */}
        <link rel="manifest" href="/api/manifest" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
