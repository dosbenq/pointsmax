import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { CompareGrid } from '@/components/ui/compare/CompareGrid'
import { WinnerBar } from '@/components/ui/compare/WinnerBar'
import { getConfiguredAppOrigin } from '@/lib/app-origin'
import { buildCardComparePayloads } from '@/lib/card-compare'
import { getCanonicalCardSlug } from '@/lib/card-surfaces'
import { getActiveCards, normalizeGeography } from '@/lib/db/cards'
import {
  getComparisonPageBySlug,
  listComparisonPagesForRegion,
  slugifyCardName,
} from '@/lib/programmatic-content'
import type { Region } from '@/lib/regions'
import type { CardWithRates } from '@/types/database'

type Props = {
  params: Promise<{ region: string; slug: string }>
}

const FAQ_COPY: Record<string, Array<{ question: string; answer: string }>> = {
  travel: [
    {
      question: 'What makes a travel card worth it?',
      answer: 'The best travel cards combine strong transfer partners, usable travel perks, and a rewards currency you can actually redeem well from your home market.',
    },
    {
      question: 'Should I optimize for lounge access or points?',
      answer: 'If you travel often, lounge access can justify a premium fee. If you travel less, the points and transfer flexibility usually matter more.',
    },
  ],
  premium: [
    {
      question: 'When does a premium annual fee make sense?',
      answer: 'A premium fee only makes sense if you consistently use the card’s credits, lounge access, accelerated earning, and transfer ecosystem.',
    },
    {
      question: 'What is the biggest mistake with premium cards?',
      answer: 'Paying for premium positioning without actually using the perks. The fee has to be defended by behavior, not branding.',
    },
  ],
  low_fees: [
    {
      question: 'Can a lower-fee card still be a strong travel card?',
      answer: 'Yes. Lower-fee cards often win on net value because you keep more of the rewards you earn instead of paying for unused premium benefits.',
    },
  ],
  simplicity: [
    {
      question: 'What makes a card simple?',
      answer: 'A simple card is one where the best use case is obvious, the benefit structure is understandable, and you do not need constant optimization to win.',
    },
  ],
}

function normalizeRegion(region: string): Region {
  return region === 'in' ? 'in' : 'us'
}

function buildComparisonSlugCandidates(card: CardWithRates): Set<string> {
  const nameSlug = slugifyCardName(card.name)
  const issuerSlug = slugifyCardName(card.issuer)
  return new Set([
    card.id,
    getCanonicalCardSlug(card),
    nameSlug,
    `${nameSlug}-${issuerSlug}`,
  ])
}

function pickCardsBySlug(cards: CardWithRates[], requestedSlugs: string[]): CardWithRates[] {
  const matched = new Map<string, CardWithRates>()

  for (const requestedSlug of requestedSlugs) {
    const requested = requestedSlug.trim().toLowerCase()
    if (!requested) continue
    const card = cards.find((candidate) => buildComparisonSlugCandidates(candidate).has(requested))
    if (card) {
      matched.set(card.id, card)
    }
  }

  return [...matched.values()]
}

export async function generateStaticParams() {
  const params: Array<{ region: Region; slug: string }> = []
  for (const region of ['us', 'in'] as const) {
    const pages = await listComparisonPagesForRegion(region)
    for (const page of pages) {
      params.push({ region, slug: page.slug })
    }
  }
  return params
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, slug } = await params
  const normalizedRegion = normalizeRegion(region)
  const page = await getComparisonPageBySlug(normalizedRegion, slug)

  if (!page) {
    return { title: 'Comparison not found | PointsMax' }
  }

  const appOrigin = getConfiguredAppOrigin()
  const title = `${page.title} | PointsMax`
  const description = page.description
  const canonical = `${appOrigin}/${normalizedRegion}/cards/best/${page.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function ComparisonLandingPage({ params }: Props) {
  const { region, slug } = await params
  const normalizedRegion = normalizeRegion(region)
  const page = await getComparisonPageBySlug(normalizedRegion, slug)

  if (!page) {
    notFound()
  }

  const allCards = await getActiveCards(normalizeGeography(region))
  const selectedCards = pickCardsBySlug(allCards, page.cardSlugs).slice(0, 4)
  const compareCards = buildCardComparePayloads(selectedCards, normalizedRegion)
  const faqs = FAQ_COPY[page.categoryFocus ?? ''] ?? FAQ_COPY.travel

  return (
    <div className="min-h-screen flex flex-col bg-pm-bg">
      <NavBar />
      <main className="flex-1 py-12">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 space-y-10">
          <section className="pm-card p-8 sm:p-10">
            <span className="pm-pill">PointsMax comparison</span>
            <h1 className="pm-heading text-3xl sm:text-5xl mt-4">{page.title}</h1>
            <p className="pm-subtle mt-4 max-w-3xl text-base sm:text-lg">{page.description}</p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link href={`/${normalizedRegion}/card-recommender`} className="pm-button px-5 py-3">
                Open card matcher
              </Link>
              <Link href={`/${normalizedRegion}/cards`} className="pm-button-secondary px-5 py-3">
                Browse all cards
              </Link>
            </div>
          </section>

          {compareCards.length >= 2 ? (
            <>
              <WinnerBar cards={compareCards} />
              <CompareGrid cards={compareCards} region={normalizedRegion} sourcePage="comparison-landing" />
            </>
          ) : (
            <section className="pm-card p-8">
              <h2 className="pm-heading text-2xl mb-3">Comparison is being expanded</h2>
              <p className="pm-subtle">
                This landing page is live, but the underlying card set is still being mapped to the latest catalog slugs.
              </p>
            </section>
          )}

          <section className="grid md:grid-cols-2 gap-6">
            <div className="pm-card-soft p-6">
              <h2 className="pm-heading text-xl mb-3">How to use this comparison</h2>
              <ul className="space-y-3 text-sm text-pm-ink-700">
                <li>Start with the quick verdict and winner bar to see which card wins by use case.</li>
                <li>Use fees and math to understand net value instead of focusing only on bonus headlines.</li>
                <li>Open the full card review for the winner if you want deeper wallet-fit detail.</li>
              </ul>
            </div>
            <div className="pm-card-soft p-6">
              <h2 className="pm-heading text-xl mb-3">Who this page helps most</h2>
              <p className="text-sm text-pm-ink-700">
                Users who already know the card family they care about, but want a cleaner decision than a giant affiliate table.
              </p>
            </div>
          </section>

          <section className="pm-card p-8">
            <h2 className="pm-heading text-2xl mb-6">Frequently asked questions</h2>
            <div className="space-y-5">
              {faqs.map((faq) => (
                <div key={faq.question} className="border-b border-pm-border pb-4 last:border-b-0">
                  <h3 className="font-semibold text-pm-ink-900">{faq.question}</h3>
                  <p className="text-sm text-pm-ink-600 mt-2">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
