import type { Metadata } from 'next'
import { GeistMono, GeistSans } from 'geist/font'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { assertServerEnv } from '@/lib/env'
import MonitoringBoot from '@/components/MonitoringBoot'
import PostHogProvider from '@/components/PostHogProvider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'

if (process.env.NODE_ENV === 'production') {
  assertServerEnv()
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pointsmax.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'PointsMax — Maximize Your Loyalty Points',
    template: '%s | PointsMax',
  },
  description:
    'Find the highest-value redemption for your Chase, Amex, Capital One, airline, and hotel points. Free AI-powered analysis across 20+ loyalty programs.',
  keywords: [
    'points calculator',
    'miles calculator',
    'credit card points',
    'Chase Ultimate Rewards calculator',
    'Amex Membership Rewards calculator',
    'award travel',
    'cents per point',
    'transfer partners',
    'loyalty points value',
    'best use of points',
  ],
  authors: [{ name: 'PointsMax' }],
  openGraph: {
    type: 'website',
    siteName: 'PointsMax',
    title: 'PointsMax — Maximize Your Loyalty Points',
    description:
      'Find the highest-value redemption for your Chase, Amex, Capital One, airline, and hotel points. Free across 20+ programs.',
    url: BASE_URL,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'PointsMax — Maximize Your Loyalty Points',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PointsMax — Maximize Your Loyalty Points',
    description:
      'Find the highest-value redemption for your Chase, Amex, Capital One, airline, and hotel points.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'PointsMax',
  url: BASE_URL,
  description:
    'AI-powered loyalty points calculator that finds the highest-value redemption across 20+ programs including Chase, Amex, United, Delta, Hyatt, and more.',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Points value calculator across 20+ loyalty programs',
    'Transfer partner mapping',
    'Award flight search',
    'AI-powered travel advisor',
    'Cents-per-point (CPP) valuations sourced from TPG',
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`} suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <PostHogProvider>
            <AuthProvider>
              <MonitoringBoot />
              {children}
              <Toaster />
            </AuthProvider>
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
