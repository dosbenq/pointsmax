import type { Metadata } from 'next'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { listCardsForRegion } from '@/lib/programmatic-content'
import { REGIONS, type Region } from '@/lib/regions'
import { formatCurrencyRounded, spendUnitLabel } from '@/lib/card-tools'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Credit Cards Directory',
  description: 'Browse reward cards, earn rates, and estimated points value by region.',
}

type Props = {
  params: Promise<{ region: string }>
}

export default async function CardsIndexPage({ params }: Props) {
  const { region } = await params
  const normalized = (region === 'in' ? 'in' : 'us') as Region
  const config = REGIONS[normalized]
  const cards = await listCardsForRegion(normalized)

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 pm-shell py-12 space-y-6">
        <div>
          <span className="pm-pill">Card directory {config.flag}</span>
          <h1 className="pm-heading text-3xl mt-3">Best reward cards in {config.label}</h1>
          <p className="pm-subtle mt-2">
            Programmatic card pages with earn rates, current point valuation, and direct apply links.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => {
            const defaultRate =
              card.earning_rates.find((row) => row.category === 'other')?.earn_multiplier ??
              card.earning_rates[0]?.earn_multiplier ??
              0
            return (
              <Link key={card.id} href={`/${normalized}/cards/${card.slug}`} className="pm-card-soft p-5 hover:shadow-md transition-shadow">
                <p className="text-xs text-pm-ink-500">{card.issuer}</p>
                <h2 className="pm-heading text-lg mt-1">{card.name}</h2>
                <p className="text-sm text-pm-ink-500 mt-2">
                  Fee: {formatCurrencyRounded(card.annual_fee_usd, card.currency)}
                </p>
                <p className="text-sm text-pm-ink-500 mt-1">
                  Base earn: {Number(defaultRate).toFixed(2)} pts {spendUnitLabel(card.earn_unit, card.currency)}
                </p>
                <p className="text-sm text-pm-ink-500 mt-1">
                  Program: {card.program?.name ?? 'Unknown'}
                </p>
              </Link>
            )
          })}
        </div>
      </main>
      <Footer />
    </div>
  )
}
