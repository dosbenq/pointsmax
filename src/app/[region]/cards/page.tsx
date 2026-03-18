import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { estimateEffectiveCashbackPct, listCardsForRegion } from '@/lib/programmatic-content'
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
  const flexibleCards = cards.filter((card) => card.program?.type === 'transferable_points').length
  const premiumCards = cards.filter((card) => card.annual_fee_usd > (normalized === 'in' ? 10000 : 250)).length
  const quickActions = [
    {
      href: `/${normalized}/calculator`,
      title: 'See what your points can book',
      description: normalized === 'in'
        ? 'Start with your HDFC, Axis, Amex, and airline balances and turn them into reachable redemptions.'
        : 'Start with your Chase, Amex, Citi, Bilt, and airline balances and see reachable redemptions first.',
    },
    {
      href: `/${normalized}/trip-builder`,
      title: 'Build my plan',
      description: 'Go from balances and routes to transfer steps, booking guidance, and a concrete execution path.',
    },
    {
      href: `/${normalized}/profile`,
      title: 'Track my wallet',
      description: 'Save manual balances or import statements so card and booking decisions stay grounded in reality.',
    },
  ]
  const operatingNotes = [
    normalized === 'in'
      ? 'Prioritize cards that transfer into programs you can actually use for Air India, Accor, Taj, and international partners.'
      : 'Prioritize cards that earn flexible currencies before you optimize for a single airline or hotel silo.',
    'Use the card pages to judge whether the annual fee, issuer friction, and transfer value fit your real wallet behavior.',
    'Treat every “best card” decision as part of a booking workflow, not as an isolated affiliate click.',
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">
        <section className="pm-page-header">
          <div className="pm-shell space-y-8">
            <div className="max-w-3xl">
              <span className="pm-pill">Card strategy hub {config.flag}</span>
              <h1 className="pm-heading text-4xl sm:text-5xl mt-4">Best reward cards in {config.label}</h1>
              <p className="pm-subtle mt-4 max-w-2xl text-base sm:text-lg">
                These cards only matter if they help you book better trips. Use this directory to connect earn rates,
                transfer ecosystems, and real redemption workflows instead of browsing disconnected rankings.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="pm-card-soft p-5">
                <p className="pm-label">Tracked cards</p>
                <p className="mt-2 text-3xl font-bold text-pm-ink-900">{cards.length}</p>
                <p className="mt-2 text-sm text-pm-ink-500">Public card reviews currently mapped for {config.label}.</p>
              </div>
              <div className="pm-card-soft p-5">
                <p className="pm-label">Flexible currencies</p>
                <p className="mt-2 text-3xl font-bold text-pm-ink-900">{flexibleCards}</p>
                <p className="mt-2 text-sm text-pm-ink-500">Cards that earn transferable points before you pick a specific airline or hotel.</p>
              </div>
              <div className="pm-card-soft p-5">
                <p className="pm-label">Premium tier cards</p>
                <p className="mt-2 text-3xl font-bold text-pm-ink-900">{premiumCards}</p>
                <p className="mt-2 text-sm text-pm-ink-500">Higher-fee cards where lounge access, transfer value, and execution discipline matter most.</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href} className="pm-card p-5 transition-transform hover:-translate-y-0.5">
                  <p className="pm-label text-pm-accent">{action.title}</p>
                  <p className="mt-3 text-sm leading-6 text-pm-ink-700">{action.description}</p>
                  <p className="mt-4 text-sm font-semibold text-pm-accent">Open workflow →</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="pm-shell py-8 space-y-8">
          <div className="pm-card p-6">
            <h2 className="pm-heading text-2xl">How to use this directory like an operator</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {operatingNotes.map((note) => (
                <div key={note} className="rounded-2xl border border-pm-border bg-pm-surface-soft p-4 text-sm leading-6 text-pm-ink-700">
                  {note}
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => {
              const defaultRate =
                card.earning_rates.find((row) => row.category === 'other')?.earn_multiplier ??
                card.earning_rates[0]?.earn_multiplier ??
                0
              const modeledReturn = estimateEffectiveCashbackPct(card)

              return (
                <Link key={card.id} href={`/${normalized}/cards/${card.slug}`} className="pm-card-soft p-5 hover:shadow-md transition-shadow">
                  <div className="mb-4 overflow-hidden rounded-[18px] border border-pm-border bg-white/80">
                    {card.image_url ? (
                      <Image
                        src={card.image_url}
                        alt={`${card.name} card art`}
                        width={640}
                        height={404}
                        className="h-auto w-full"
                      />
                    ) : (
                      <div className="aspect-[1.58/1] bg-gradient-to-br from-[#0d2848] to-[#1a7ea3]" />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-pm-ink-500">{card.issuer}</p>
                    <span className="rounded-full bg-pm-accent-soft px-2.5 py-1 text-[11px] font-semibold text-pm-accent">
                      {modeledReturn > 0 ? `${modeledReturn.toFixed(1)}% modeled` : `${card.cpp_cents.toFixed(2)} cpp`}
                    </span>
                  </div>
                  <h2 className="pm-heading text-lg mt-2">{card.name}</h2>
                  <p className="text-sm text-pm-ink-500 mt-2">
                    Fee: {formatCurrencyRounded(card.annual_fee_usd, card.currency)}
                  </p>
                  <p className="text-sm text-pm-ink-500 mt-1">
                    Base earn: {Number(defaultRate).toFixed(2)} pts {spendUnitLabel(card.earn_unit, card.currency)}
                  </p>
                  <p className="text-sm text-pm-ink-500 mt-1">
                    Program: {card.program?.name ?? 'Unknown'}
                  </p>
                  <p className="mt-4 text-sm text-pm-ink-700">
                    Best next step: review the card, then jump straight into the linked program and booking workflow.
                  </p>
                </Link>
              )
            })}
          </div>

          <section className="pm-card-soft p-8 sm:p-10">
            <div className="max-w-3xl">
              <h2 className="pm-heading text-2xl">Turn card research into a booking decision</h2>
              <p className="pm-subtle mt-3">
                The best card is the one that moves your current wallet closer to a real redemption. Compare cards here,
                then use PointsMax to check reachability, transfer friction, and the exact next action.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/${normalized}/card-recommender`} className="pm-button-secondary">
                Improve my card strategy
              </Link>
              <Link href={`/${normalized}/programs`} className="pm-button-secondary">
                Explore transfer programs
              </Link>
              <Link href={`/${normalized}/calculator`} className="pm-button">
                See what my points can book
              </Link>
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </div>
  )
}
