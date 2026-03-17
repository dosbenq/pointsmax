import Link from 'next/link'
import type { Metadata } from 'next'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { WinnerBar } from '@/components/ui/compare/WinnerBar'
import { CompareGrid } from '@/components/ui/compare/CompareGrid'
import { getActiveCards, normalizeGeography } from '@/lib/db/cards'
import { getCanonicalCardSlug } from '@/lib/card-surfaces'
import { buildCardComparePayloads } from '@/lib/card-compare'
import type { Region } from '@/lib/regions'

type Props = {
  params: Promise<{ region: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: 'Compare Reward Cards',
  description: 'Compare fees, reward rates, perks, and fit across multiple cards.',
}

function normalizeRegion(region: string): Region {
  return region === 'in' ? 'in' : 'us'
}

function parseRequestedCards(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => entry.split(',')).map((entry) => entry.trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw.split(',').map((entry) => entry.trim()).filter(Boolean)
  }
  return []
}

export default async function CardComparePage({ params, searchParams }: Props) {
  const { region } = await params
  const requested = parseRequestedCards((await searchParams).cards)
  const normalized = normalizeRegion(region)
  const cards = await getActiveCards(normalizeGeography(region))
  const selectedCards = cards.filter((card) => {
    const slug = getCanonicalCardSlug(card)
    return requested.includes(slug) || requested.includes(card.id)
  }).slice(0, 4)

  const compareCards = buildCardComparePayloads(selectedCards, normalized)

  return (
    <div className="min-h-screen flex flex-col bg-pm-bg">
      <NavBar />
      <main className="flex-1 py-12">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 mb-10">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div>
              <span className="pm-pill">Card compare</span>
              <h1 className="pm-heading text-3xl sm:text-4xl mt-3">Compare cards side by side</h1>
              <p className="pm-subtle mt-2 max-w-2xl">
                See fees, rewards, lifestyle benefits, and wallet fit in one place. Compare up to four cards at once.
              </p>
            </div>
            <Link href={`/${normalized}/card-recommender`} className="pm-button-secondary px-4 py-2">
              Back to Recommender
            </Link>
          </div>

          {compareCards.length < 2 ? (
            <div className="pm-card p-8 text-center">
              <h2 className="pm-heading text-xl mb-3">Pick at least two cards to compare</h2>
              <p className="pm-subtle mb-6">
                Open this page from the recommender or a card review to prefill your compare set.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                {cards.slice(0, 4).map((card) => (
                  <Link
                    key={card.id}
                    href={`/${normalized}/cards/${getCanonicalCardSlug(card)}`}
                    className="pm-button-secondary px-4 py-2"
                  >
                    {card.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <>
              <WinnerBar cards={compareCards} />
              <CompareGrid
                cards={compareCards}
                region={normalized}
                sourcePage="card-compare"
              />
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
