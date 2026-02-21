import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Points Calculator — Find the Best Redemption',
  description:
    'Enter your Chase, Amex, Capital One, airline, and hotel balances. Our engine ranks every redemption by cents-per-point value across 20+ loyalty programs — instantly, for free.',
  openGraph: {
    title: 'Points Calculator — Find the Best Redemption | PointsMax',
    description:
      'Rank every redemption by cents-per-point value across 20+ loyalty programs. Free, no account required.',
    url: '/calculator',
  },
  alternates: {
    canonical: '/calculator',
  },
}

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return children
}
