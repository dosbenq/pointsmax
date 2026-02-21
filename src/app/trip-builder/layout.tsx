import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Trip Builder — PointsMax',
  description: 'Get a complete AI-powered trip plan using your points. Flight options, hotel recommendations, and step-by-step booking guide.',
}

export default function TripBuilderLayout({ children }: { children: React.ReactNode }) {
  return children
}
