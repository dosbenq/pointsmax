import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, Info, Map, RefreshCw, Shield, Sparkles } from 'lucide-react'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { TrackedApplyButton } from '@/components/cards/TrackedApplyButton'
import { getConfiguredAppOrigin } from '@/lib/app-origin'
import { CARD_ART_MAP, formatCurrencyRounded } from '@/lib/card-tools'
import { buildReviewSnapshotFromCard, getCanonicalCardSlug } from '@/lib/card-surfaces'
import { matchesCardRouteSlug } from '@/lib/card-slugs'
import { getActiveCards, normalizeGeography } from '@/lib/db/cards'
import { createSafeJsonLdScript } from '@/lib/jsonld-sanitize'
import { REGIONS } from '@/lib/regions'
import { buildBreadcrumbJsonLd, buildCardProductJsonLd } from '@/lib/seo-structured-data'
import { getComparisonPagesForCard } from '@/lib/programmatic-content'
import {
  getCardFeatureProfile,
  getSoftBenefits,
  SOFT_BENEFIT_COPY,
} from '@/features/card-recommender'
import type { CardWithRates, SpendCategory } from '@/types/database'

type PageProps = {
  params: Promise<{ region: string; slug: string }>
}

function findCardByRouteSlug(cards: CardWithRates[], slug: string): CardWithRates | null {
  return cards.find((entry) => matchesCardRouteSlug(entry, slug)) ?? null
}

const RATE_LABELS: Record<SpendCategory, string> = {
  dining: 'Dining',
  groceries: 'Groceries',
  travel: 'Travel',
  gas: 'Gas',
  shopping: 'Shopping',
  streaming: 'Streaming',
  other: 'Everyday Spend',
}

function formatCpp(cppCents: number): string {
  return `${cppCents.toFixed(2)} cpp`
}

function getSortedRates(card: CardWithRates) {
  return Object.entries(card.earning_rates)
    .filter(([, multiplier]) => Number.isFinite(multiplier) && multiplier > 0)
    .sort(([, left], [, right]) => right - left)
    .map(([category, multiplier]) => ({
      label: RATE_LABELS[category as SpendCategory] ?? category,
      value: `${multiplier}x`,
      multiplier,
    }))
}

function buildBestFor(card: CardWithRates): string[] {
  const featureProfile = getCardFeatureProfile(card)
  const sortedRates = getSortedRates(card)
  const topRate = sortedRates[0]
  const items: string[] = []

  if (topRate && topRate.multiplier > 1) {
    items.push(`${topRate.label} spenders who want to maximize their top category`)
  }
  if (getSoftBenefits(card).includes('lounge_access')) {
    items.push('Travelers who value airport lounge access and premium journey benefits')
  }
  if (card.annual_fee_usd === 0) {
    items.push('People who want a long-term keeper card without an annual fee')
  } else if (card.annual_fee_usd >= (card.currency === 'INR' ? 10000 : 250)) {
    items.push('Wallets that can justify a premium annual fee with real usage')
  }
  if (card.cpp_cents >= 1.8) {
    items.push(`Users aiming to extract strong transfer value from ${card.program_name}`)
  }
  if (featureProfile.complexity === 'low') {
    items.push('People who want simpler rewards without much optimization overhead')
  }

  return items.slice(0, 4)
}

function buildWatchOuts(card: CardWithRates): string[] {
  const featureProfile = getCardFeatureProfile(card)
  const items: string[] = []

  if (card.annual_fee_usd > 0) {
    items.push(`Annual fee is ${formatCurrencyRounded(card.annual_fee_usd, card.currency)}, so the value needs to be used, not just admired`)
  }
  if (featureProfile.issuerRules.includes('chase_5_24')) {
    items.push('Approval strategy matters because Chase 5/24 can block this card')
  }
  if (featureProfile.issuerRules.includes('bonus_eligibility_uncertain')) {
    items.push('Welcome bonus eligibility can depend on family rules and prior holding history')
  }
  if (featureProfile.complexity === 'high') {
    items.push('This card gets its best value when you actively use its perks and partner ecosystem')
  }
  if (getSoftBenefits(card).length === 0) {
    items.push('Benefit upside is lighter, so the core case needs to come from earning and redemption value')
  }

  return items.slice(0, 4)
}

function buildOverview(card: CardWithRates): string {
  const bestFor = buildBestFor(card)
  const sortedRates = getSortedRates(card)
  const topRate = sortedRates[0]

  if (topRate && bestFor.length > 0) {
    return `${card.name} is strongest when your wallet already aligns with ${card.program_name} and you can lean into ${topRate.label.toLowerCase()} spend. The case for the card comes from the combination of earning power, redemption value, and any premium perks mapped to its profile.`
  }

  return `${card.name} is best treated as a program-centric wallet move. The value comes less from one flashy line item and more from how well it fits into your broader points strategy.`
}

function buildAlternatives(card: CardWithRates, cards: CardWithRates[]): CardWithRates[] {
  const scored = cards
    .filter((candidate) => candidate.id !== card.id)
    .map((candidate) => {
      let score = 0
      if (candidate.program_id === card.program_id) score += 4
      if (candidate.issuer === card.issuer) score += 3
      if (candidate.currency === card.currency) score += 2
      score -= Math.abs(candidate.annual_fee_usd - card.annual_fee_usd) / (card.currency === 'INR' ? 5000 : 50)
      return { candidate, score }
    })
    .sort((left, right) => right.score - left.score)

  return scored.slice(0, 3).map((entry) => entry.candidate)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const allCards = await getActiveCards(normalizeGeography(resolvedParams.region))
  const card = findCardByRouteSlug(allCards, resolvedParams.slug)

  if (!card) {
    return { title: 'Card not found | PointsMax' }
  }

  const topRate = getSortedRates(card)[0]
  const appOrigin = getConfiguredAppOrigin()
  const canonical = `${appOrigin}/${resolvedParams.region}/cards/${getCanonicalCardSlug(card)}`
  const description = `${card.name} earns ${topRate ? `${topRate.value} on ${topRate.label}` : `${card.cpp_cents.toFixed(2)} cpp in ${card.program_name}`}. Annual fee: ${card.annual_fee_usd === 0 ? 'Free' : formatCurrencyRounded(card.annual_fee_usd, card.currency)}. Compare, calculate, and review the fit on PointsMax.`

  return {
    title: `${card.name} Review | PointsMax`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${card.name} Review | PointsMax`,
      description,
      url: canonical,
      images: [`${appOrigin}/${resolvedParams.region}/cards/${getCanonicalCardSlug(card)}/opengraph-image`],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${card.name} Review | PointsMax`,
      description,
      images: [`${appOrigin}/${resolvedParams.region}/cards/${getCanonicalCardSlug(card)}/opengraph-image`],
    },
  }
}

export default async function CardReviewPage({ params }: PageProps) {
  const resolvedParams = await params
  const region = resolvedParams.region === 'in' ? 'in' : 'us'
  const allCards = await getActiveCards(normalizeGeography(resolvedParams.region))
  const card = findCardByRouteSlug(allCards, resolvedParams.slug)

  if (!card) return notFound()

  const snapshot = buildReviewSnapshotFromCard(card)
  const rates = getSortedRates(card)
  const bestFor = buildBestFor(card)
  const watchOuts = buildWatchOuts(card)
  const overview = buildOverview(card)
  const featureProfile = getCardFeatureProfile(card)
  const softBenefits = getSoftBenefits(card).map((benefit) => SOFT_BENEFIT_COPY[benefit])
  const alternatives = buildAlternatives(card, allCards)
  const relevantComparisons = await getComparisonPagesForCard(getCanonicalCardSlug(card), region)
  const compareHref = alternatives.length > 0
    ? `/${resolvedParams.region}/cards/compare?cards=${[card, ...alternatives.slice(0, 2)].map((entry) => getCanonicalCardSlug(entry)).join(',')}`
    : `/${resolvedParams.region}/cards/compare?cards=${getCanonicalCardSlug(card)}`
  const baseUrl = getConfiguredAppOrigin()
  const regionConfig = REGIONS[region]
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: `/${resolvedParams.region}` },
    { name: 'Cards', url: `/${resolvedParams.region}/cards` },
    { name: card.name, url: `/${resolvedParams.region}/cards/${getCanonicalCardSlug(card)}` },
  ], baseUrl)
  const productJsonLd = buildCardProductJsonLd({
    name: card.name,
    issuer: card.issuer,
    description: overview,
    applyUrl: card.apply_url ?? `/${resolvedParams.region}/cards/${getCanonicalCardSlug(card)}`,
    imageUrl: CARD_ART_MAP[card.name] || card.image_url,
    region: resolvedParams.region,
  }, baseUrl)
  const actionPlan = [
    {
      href: `/${resolvedParams.region}/profile`,
      title: 'Track this rewards currency',
      description: `Save your ${card.program_name} balance in Wallet so future searches reflect what you can really reach.`,
    },
    {
      href: `/${resolvedParams.region}/calculator`,
      title: 'See what this card helps you book',
      description: 'Check whether the modeled value survives once you compare real programs, routes, and transfer friction.',
    },
    {
      href: `/${resolvedParams.region}/trip-builder`,
      title: 'Build a booking plan',
      description: 'Move from card and program theory into the exact next transfer and booking steps.',
    },
  ]
  const regionAngle = region === 'in'
    ? `In ${regionConfig.label}, this card only wins if it improves your HDFC / Axis / Amex-style transfer options or gives you a better local earn story than simpler cashback cards.`
    : `In the ${regionConfig.label}, this card only wins if it improves your transfer optionality or meaningfully outperforms simpler cashback alternatives for your actual spend.`

  return (
    <div className="min-h-screen flex flex-col bg-pm-bg">
      <NavBar />

      <div className="bg-pm-surface-soft border-b border-pm-border pt-12 pb-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(circle_at_top_right,rgba(var(--pm-accent-rgb),0.06)_0%,transparent_70%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center gap-12 relative z-10">
          <div className="w-full max-w-[320px] md:w-[400px] shrink-0 drop-shadow-2xl">
            {(CARD_ART_MAP[card.name] || card.image_url) ? (
              <Image
                src={CARD_ART_MAP[card.name] || card.image_url!}
                alt={card.name}
                width={640}
                height={404}
                className="w-full h-auto rounded-[18px] border border-pm-border/50"
              />
            ) : (
              <div className="aspect-[1.586/1] bg-gradient-to-br from-[#0d2848] to-[#1a7ea3] rounded-[18px] border border-pm-border" />
            )}
          </div>

          <div className="flex-1 w-full text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4 text-xs font-bold text-pm-ink-500 uppercase tracking-widest mb-4">
              <Link href={`/${resolvedParams.region}/cards`} className="hover:text-pm-ink-900 transition-colors">
                ← All Cards
              </Link>
              <span className="hidden md:inline">•</span>
              <span>{card.issuer} · {card.program_name}</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-pm-ink-900 tracking-tight leading-tight mb-4">
              {card.name}
            </h1>
            <p className="text-lg text-pm-ink-600 max-w-3xl mb-6">
              {overview}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-8">
              <span className="pm-pill">{featureProfile.complexity} complexity</span>
              <span className="pm-pill">{formatCpp(card.cpp_cents)} value</span>
              {softBenefits[0] && <span className="pm-pill">{softBenefits[0]}</span>}
              {card.annual_fee_usd === 0 && <span className="pm-pill">No annual fee</span>}
            </div>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-pm-surface rounded-xl border border-pm-border px-5 py-4 shadow-sm text-left">
                <p className="text-[10px] font-bold text-pm-ink-500 uppercase tracking-widest mb-1">Annual Fee</p>
                <p className="text-xl font-bold text-pm-ink-900">
                  {snapshot.annualFee === 0 ? 'Free' : formatCurrencyRounded(snapshot.annualFee, snapshot.currency)}
                </p>
              </div>

              <div className="bg-pm-surface rounded-xl border border-pm-border px-5 py-4 shadow-sm text-left">
                <p className="text-[10px] font-bold text-pm-ink-500 uppercase tracking-widest mb-1">Welcome Bonus</p>
                <p className="text-xl font-bold text-pm-accent-strong">
                  {snapshot.welcomeBonus ? snapshot.welcomeBonus.points.toLocaleString() : 'None'}
                </p>
                {snapshot.welcomeBonus && (
                  <p className="text-xs text-pm-ink-500 pt-0.5">
                    Spend {formatCurrencyRounded(snapshot.welcomeBonus.spendRequirement, snapshot.currency)}
                  </p>
                )}
              </div>

              <div className="bg-pm-surface rounded-xl border border-pm-border px-5 py-4 shadow-sm text-left">
                <p className="text-[10px] font-bold text-pm-ink-500 uppercase tracking-widest mb-1">Best Earn Rate</p>
                <p className="text-xl font-bold text-pm-ink-900">
                  {rates[0] ? `${rates[0].value} ${rates[0].label}` : 'Pending'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <TrackedApplyButton
                card={card}
                region={resolvedParams.region}
                sourcePage="card-review"
                className="pm-button px-8 py-3.5 shadow-md shadow-pm-accent/20 w-full md:w-auto text-lg transition-transform hover:-translate-y-0.5"
                label="Apply Now"
                unavailableLabel="Link Unavailable"
              />
              <Link href={compareHref} className="pm-button-secondary px-8 py-3.5 w-full md:w-auto text-lg text-center">
                Compare Alternatives
              </Link>
              <p className="text-xs text-pm-ink-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Catalog-driven review based on current card and program data
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-6 -mt-6 relative z-20">
        <section className="pm-card-soft p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="pm-label text-pm-accent">Make this card useful</p>
              <h2 className="pm-heading text-2xl mt-3">Treat {card.name} as part of a booking workflow, not just a review page</h2>
              <p className="mt-4 text-sm leading-7 text-pm-ink-700">{regionAngle}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {actionPlan.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-2xl border border-pm-border bg-pm-surface px-4 py-4 transition-transform hover:-translate-y-0.5">
                    <p className="text-sm font-semibold text-pm-ink-900">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-pm-ink-500">{item.description}</p>
                  </Link>
                ))}
              </div>
            </div>
            <div className="pm-card p-5">
              <h3 className="pm-heading text-lg mb-3">Execution summary</h3>
              <ul className="space-y-3 text-sm leading-6 text-pm-ink-700">
                <li>Rewards currency: {card.program_name}</li>
                <li>Modeled point value: {formatCpp(card.cpp_cents)}</li>
                <li>Primary decision: whether the earning power and transfer ecosystem beat a simpler card in your wallet.</li>
              </ul>
              <Link href={`/${resolvedParams.region}/programs/${card.program_slug}`} className="mt-5 inline-flex text-sm font-semibold text-pm-accent hover:underline">
                Review the {card.program_name} program →
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="sticky top-0 z-40 bg-pm-surface/90 backdrop-blur-md border-b border-pm-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex overflow-x-auto scrollbar-hide text-sm font-bold uppercase tracking-widest">
          {['Overview', 'Rewards', 'Perks', 'Redemptions', 'Alternatives', 'Updates'].map((tab) => (
            <a
              key={tab}
              href={`#${tab.toLowerCase()}`}
              className="py-4 px-6 text-pm-ink-500 hover:text-pm-accent hover:border-pm-accent border-b-2 border-transparent transition-all whitespace-nowrap"
            >
              {tab}
            </a>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-6 py-12 space-y-20">
        <section id="overview" className="scroll-mt-24 space-y-8">
          <h2 className="text-3xl font-bold text-pm-ink-900">Who this card fits</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-pm-surface border border-pm-border rounded-[20px] p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Check className="text-pm-success w-5 h-5 bg-pm-success-soft rounded-full p-1 border border-pm-success-border" />
                <h3 className="font-bold text-pm-ink-900 text-lg">Best for</h3>
              </div>
              <ul className="space-y-3">
                {bestFor.map((item) => (
                  <li key={item} className="text-sm text-pm-ink-700 font-medium">{item}</li>
                ))}
              </ul>
            </div>

            <div className="bg-pm-surface border border-pm-border rounded-[20px] p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="text-pm-ink-500 w-5 h-5 bg-pm-surface-soft rounded-full p-1 border border-pm-border" />
                <h3 className="font-bold text-pm-ink-900 text-lg">Watch-outs</h3>
              </div>
              <ul className="space-y-3">
                {watchOuts.map((item) => (
                  <li key={item} className="text-sm text-pm-ink-700 font-medium">{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="prose prose-pm text-pm-ink-700 leading-relaxed text-lg bg-pm-surface-soft p-8 rounded-[24px]">
            <p>{overview}</p>
          </div>
        </section>

        <section id="rewards" className="scroll-mt-24">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-pm-accent-soft rounded-xl border border-pm-accent-border text-pm-accent">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold text-pm-ink-900">Rewards Engine</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {rates.map((rate) => (
              <div key={`${rate.label}-${rate.value}`} className="bg-pm-surface border border-pm-border rounded-[16px] p-5 shadow-sm hover:border-pm-accent/40 transition-colors">
                <p className="text-3xl font-black text-pm-accent mb-1">{rate.value}</p>
                <p className="text-sm font-bold text-pm-ink-500 uppercase tracking-wide">{rate.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-pm-surface-soft border border-pm-border rounded-[24px] p-8 text-pm-ink-700">
            The modeled point value for this card’s rewards currency is <strong>{formatCpp(card.cpp_cents)}</strong>. The real upside depends on how strongly you can redeem within {card.program_name}, not just how many points you earn.
          </div>
        </section>

        <section id="perks" className="scroll-mt-24">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-pm-accent-soft rounded-xl border border-pm-accent-border text-pm-accent">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold text-pm-ink-900">Benefits & Approval Notes</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-pm-surface border border-pm-border rounded-[20px] p-6">
              <h3 className="pm-heading text-lg mb-4">Modeled benefit profile</h3>
              {softBenefits.length > 0 ? (
                <ul className="space-y-3 text-sm text-pm-ink-700">
                  {softBenefits.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-pm-ink-500">
                  No premium benefit profile is mapped for this card yet. Treat it as earning-first unless the issuer’s public benefit stack changes that conclusion.
                </p>
              )}
            </div>

            <div className="bg-pm-surface border border-pm-border rounded-[20px] p-6">
              <h3 className="pm-heading text-lg mb-4">Issuer rules and friction</h3>
              <ul className="space-y-3 text-sm text-pm-ink-700">
                {featureProfile.issuerRules.map((rule) => (
                  <li key={rule}>
                    {rule === 'chase_5_24' && 'Chase 5/24 should be considered before applying.'}
                    {rule === 'duplicate_card_not_allowed' && 'This card should not be treated as stackable with duplicate holdings.'}
                    {rule === 'bonus_eligibility_uncertain' && 'Welcome bonus eligibility may depend on prior issuer-family history.'}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="redemptions" className="scroll-mt-24">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-pm-accent-soft rounded-xl border border-pm-accent-border text-pm-accent">
              <Map className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold text-pm-ink-900">Redemption Strategy</h2>
          </div>

          <div className="bg-pm-surface-soft border border-pm-border rounded-[24px] p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold text-pm-ink-500 uppercase tracking-widest mb-1">Program</p>
                <p className="text-xl font-bold text-pm-ink-900">{card.program_name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-pm-ink-500 uppercase tracking-widest mb-1">Modeled Value</p>
                <p className="text-xl font-bold text-pm-success">{formatCpp(card.cpp_cents)}</p>
              </div>
            </div>

            <div className="bg-pm-surface px-6 py-4 rounded-xl shadow-sm border border-pm-border border-l-4 border-l-pm-accent text-pm-ink-700">
              Treat this card as a {card.program_name}-building tool. If you already like that ecosystem, this card can compound nicely. If you do not, the headline earn rates may look better than the real realized value.
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href={`/${resolvedParams.region}/programs/${card.program_slug}`} className="pm-button-secondary inline-flex px-5 py-3">
                Explore the {card.program_name} program
              </Link>
              <Link href={`/${resolvedParams.region}/calculator`} className="pm-button-secondary inline-flex px-5 py-3">
                Check wallet reachability
              </Link>
              <Link href={`/${resolvedParams.region}/trip-builder`} className="pm-button inline-flex px-5 py-3">
                Build a booking plan
              </Link>
            </div>
          </div>
        </section>

        <section id="alternatives" className="scroll-mt-24">
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div>
              <h2 className="text-3xl font-bold text-pm-ink-900">Alternatives</h2>
              <p className="text-pm-ink-500 mt-2">The closest adjacent cards in the same region and rewards context.</p>
            </div>
            <Link href={compareHref} className="pm-button-secondary px-5 py-3">
              Compare This Set
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {alternatives.map((alternative) => (
              <div key={alternative.id} className="pm-card-soft p-5">
                <p className="text-xs text-pm-ink-500">{alternative.issuer}</p>
                <h3 className="pm-heading text-lg mt-1">{alternative.name}</h3>
                <p className="text-sm text-pm-ink-500 mt-2">
                  Fee: {alternative.annual_fee_usd === 0 ? 'Free' : formatCurrencyRounded(alternative.annual_fee_usd, alternative.currency)}
                </p>
                <p className="text-sm text-pm-ink-500 mt-1">
                  Program: {alternative.program_name}
                </p>
                <div className="flex gap-2 mt-4">
                  <Link href={`/${resolvedParams.region}/cards/${getCanonicalCardSlug(alternative)}`} className="pm-button-secondary px-4 py-2 text-sm">
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {relevantComparisons.length > 0 && (
            <section className="mt-10">
              <h3 className="pm-label">How this card compares</h3>
              <ul className="mt-3 space-y-2">
                {relevantComparisons.map((page) => (
                  <li key={page.slug}>
                    <Link href={page.href} className="text-sm font-medium text-pm-accent hover:underline">
                      {page.title} →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>

        <section id="updates" className="scroll-mt-24">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-pm-accent-soft rounded-xl border border-pm-accent-border text-pm-accent">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold text-pm-ink-900">Current Inputs</h2>
          </div>

          <div className="bg-pm-surface border border-pm-border rounded-[24px] p-8 text-pm-ink-700 space-y-3">
            <p>Annual fee currently modeled at {snapshot.annualFee === 0 ? 'free' : formatCurrencyRounded(snapshot.annualFee, snapshot.currency)}.</p>
            <p>Welcome bonus currently modeled at {snapshot.welcomeBonus ? `${snapshot.welcomeBonus.points.toLocaleString()} points` : 'none'}.</p>
            <p>{card.program_name} valuation currently modeled at {formatCpp(card.cpp_cents)}.</p>
          </div>
        </section>
      </div>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={createSafeJsonLdScript(breadcrumbJsonLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={createSafeJsonLdScript(productJsonLd)} />
    </div>
  )
}
