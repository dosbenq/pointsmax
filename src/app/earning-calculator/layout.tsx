import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Earning Calculator — PointsMax',
  description: 'See which credit cards earn the most points for your spending profile. Compare 11 top cards across 6 spend categories.',
}

export default function EarningCalculatorLayout({ children }: { children: React.ReactNode }) {
  return children
}
