import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How It Works — 3-Step Process',
  description:
    'Learn how PointsMax calculates your loyalty points value: enter balances, see ranked redemptions by CPP, and book with AI guidance. Free for 20+ programs.',
  openGraph: {
    title: 'How PointsMax Works — 3-Step Process | PointsMax',
    description:
      'Enter balances, see ranked redemptions by cents-per-point, and get step-by-step AI booking guidance.',
    url: '/how-it-works',
  },
  alternates: {
    canonical: '/how-it-works',
  },
}

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children
}
