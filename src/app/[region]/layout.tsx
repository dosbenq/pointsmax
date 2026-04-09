import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PageTransition from '@/components/PageTransition'

const REGION_LABELS: Record<string, string> = {
  us: 'United States',
  in: 'India',
}

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }): Promise<Metadata> {
  const { region } = await params
  const label = REGION_LABELS[region] || 'United States'
  const isIndia = region === 'in'

  return {
    title: `PointsMax ${label} — Maximize Your Loyalty Points`,
    description: isIndia
      ? 'Turn your credit card reward points into dream flights. Compare valuations for HDFC, Amex, Axis and more Indian loyalty programs.'
      : 'Turn your credit card points into dream flights. Compare valuations for Chase UR, Amex MR, and more loyalty programs.',
    alternates: {
      canonical: `/${region}`,
      languages: {
        'en-US': '/us',
        'en-IN': '/in',
      },
    },
    openGraph: {
      title: `PointsMax ${label}`,
      description: isIndia
        ? 'Maximize your Indian credit card reward points'
        : 'Maximize your credit card loyalty points',
      url: `/${region}`,
    },
  }
}

export default async function RegionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ region: string }>
}) {
  const { region } = await params
  if (region !== 'us' && region !== 'in') {
    notFound()
  }

  return <PageTransition><main id="main-content">{children}</main></PageTransition>
}
