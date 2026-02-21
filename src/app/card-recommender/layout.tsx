import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Card Recommender — PointsMax',
  description: 'Find your next credit card based on your spending habits and travel goals. Personalized recommendations with first-year value calculations.',
}

export default function CardRecommenderLayout({ children }: { children: React.ReactNode }) {
  return children
}
