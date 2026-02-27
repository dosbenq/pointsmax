import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import {
  estimateEffectiveCashbackPct,
  getCardBySlug,
  listCardsForRegion,
} from '@/lib/programmatic-content'
import { REGIONS, type Region } from '@/lib/regions'
import { CATEGORIES, formatCurrencyRounded, spendUnitLabel } from '@/lib/card-tools'
import { generateCardJsonLd } from '@/lib/seo'

type Props = {
  params: Promise<{ region: string; slug: string }>
}

export const revalidate = 3600

function normalizeRegion(region: string): Region {
  return region === 'in' ? 'in' : 'us'
}

export async function generateStaticParams() {
  const params: Array<{ region: Region; slug: string }> = []
  for (const region of ['us', 'in'] as Region[]) {
    try {
      const cards = await listCardsForRegion(region)
      for (const card of cards) {
        params.push({ region, slug: card.slug })
      }
    } catch {
      // keep static params resilient when DB is unavailable at build time
    }
  }
  return params
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, slug } = await params
  const normalized = normalizeRegion(region)
  const card = await getCardBySlug(normalized, slug)
  if (!card) {
    return { title: 'Card not found' }
  }
  return {
    title: `${card.name} Review — Earn Rates & Point Value | PointsMax`,
    description: `${card.name} (${card.issuer}) earn rates, annual fee, and estimated redemption value based on live point valuations.`,
  }
}

export default async function CardDetailPage({ params }: Props) {
  const { region, slug } = await params
  const normalized = normalizeRegion(region)
  const card = await getCardBySlug(normalized, slug)
  if (!card) notFound()

  const config = REGIONS[normalized]
  const unitLabel = spendUnitLabel(card.earn_unit, card.currency)
  const cashbackPct = estimateEffectiveCashbackPct(card)
  const jsonLd = generateCardJsonLd({
    name: card.name,
    description: `${card.name} from ${card.issuer} with reward earn rates and point value estimates.`,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://pointsmax.com'}/${normalized}/cards/${card.slug}`,
    issuer: card.issuer,
    annualFeeAmount: card.annual_fee_usd,
    annualFeeCurrency: card.currency,
  })

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 pm-shell py-12 space-y-8">
        <div>
          <span className="pm-pill">Card review {config.flag}</span>
          <h1 className="pm-heading text-3xl mt-3">{card.name}</h1>
          <p className="pm-subtle mt-2">
            Issuer: {card.issuer} · Program: {card.program?.name ?? 'Unknown'}
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="pm-card p-4">
            <p className="text-xs text-pm-ink-500">Annual fee</p>
            <p className="text-2xl font-semibold text-pm-ink-900 mt-1">{formatCurrencyRounded(card.annual_fee_usd, card.currency)}</p>
          </div>
          <div className="pm-card p-4">
            <p className="text-xs text-pm-ink-500">Current point value</p>
            <p className="text-2xl font-semibold text-pm-ink-900 mt-1">{card.cpp_cents.toFixed(2)}¢ / point</p>
          </div>
          <div className="pm-card p-4">
            <p className="text-xs text-pm-ink-500">Estimated base cashback</p>
            <p className="text-2xl font-semibold text-pm-ink-900 mt-1">{cashbackPct.toFixed(2)}%</p>
          </div>
        </section>

        <section className="pm-card-soft p-6">
          <h2 className="pm-heading text-xl mb-4">Earn rates</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {CATEGORIES.map((category) => {
              const rate = card.earning_rates.find((row) => row.category === category.key)?.earn_multiplier ?? 0
              const effectivePct = (Number(rate) * card.cpp_cents) / 100
              return (
                <div key={category.key} className="pm-card p-4">
                  <p className="text-sm text-pm-ink-500">{category.icon} {category.label}</p>
                  <p className="text-lg font-semibold text-pm-ink-900 mt-1">
                    {Number(rate).toFixed(2)} pts {unitLabel}
                  </p>
                  <p className="text-xs text-pm-ink-500 mt-1">
                    Effective value: {effectivePct.toFixed(2)}%
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="pm-card-soft p-6">
          <h2 className="pm-heading text-xl mb-2">Program and value context</h2>
          <p className="pm-subtle text-sm">
            This card earns into <strong>{card.program?.name ?? 'Unknown program'}</strong>.
            {' '}Current valuation is approximately <strong>{card.cpp_cents.toFixed(2)}¢</strong> per point.
          </p>
          {card.program?.slug ? (
            <Link href={`/${normalized}/programs/${card.program.slug}`} className="inline-block mt-3 text-sm text-pm-accent hover:underline">
              View full program page →
            </Link>
          ) : null}
          {card.apply_url ? (
            <div className="mt-4">
              <a
                href={`/api/analytics/affiliate-click?card_id=${encodeURIComponent(card.id)}&source_page=card-page`}
                rel="sponsored"
                className="pm-button inline-flex"
              >
                Apply Now →
              </a>
            </div>
          ) : null}
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}
