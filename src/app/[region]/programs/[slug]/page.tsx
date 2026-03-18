import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { getConfiguredAppOrigin } from '@/lib/app-origin'
import { getProgramBySlug, listProgramsForRegion } from '@/lib/programmatic-content'
import { REGIONS, type Region } from '@/lib/regions'
import { generateProgramJsonLd } from '@/lib/seo'
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from '@/lib/seo-structured-data'
import { createSafeJsonLdScript } from '@/lib/jsonld-sanitize'

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
      const programs = await listProgramsForRegion(region)
      for (const program of programs) {
        params.push({ region, slug: program.slug })
      }
    } catch {
      // keep build resilient if DB is unavailable in CI
    }
  }
  return params
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, slug } = await params
  const normalized = normalizeRegion(region)
  const program = await getProgramBySlug(normalized, slug)
  if (!program) return { title: 'Program not found' }
  const appOrigin = getConfiguredAppOrigin()
  const canonical = `${appOrigin}/${normalized}/programs/${program.slug}`
  const description = `${program.name} is currently valued around ${program.cpp_cents.toFixed(2)}¢/pt. Transfer to ${program.transfer_out.length} partner${program.transfer_out.length === 1 ? '' : 's'} and see the best redemption use cases on PointsMax.`
  return {
    title: `${program.name} — Current Point Value & Transfer Partners | PointsMax`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${program.name} — Current Point Value & Transfer Partners | PointsMax`,
      description,
      url: canonical,
      images: [`${appOrigin}/${normalized}/programs/${program.slug}/opengraph-image`],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${program.name} — Current Point Value & Transfer Partners | PointsMax`,
      description,
      images: [`${appOrigin}/${normalized}/programs/${program.slug}/opengraph-image`],
    },
  }
}

export default async function ProgramDetailPage({ params }: Props) {
  const { region, slug } = await params
  const normalized = normalizeRegion(region)
  const config = REGIONS[normalized]
  const program = await getProgramBySlug(normalized, slug)
  if (!program) notFound()
  const appOrigin = getConfiguredAppOrigin()

  const jsonLd = generateProgramJsonLd({
    name: program.name,
    description: `${program.name} valuation and transfer partner guide on PointsMax.`,
    url: `${appOrigin}/${normalized}/programs/${program.slug}`,
  })
  const faqJsonLd = buildFaqJsonLd([
    {
      question: `How do I earn ${program.name} points?`,
      answer: `You typically earn ${program.name} through region-mapped bank cards, issuer promotions, or direct paid activity inside the ${program.type.replace('_', ' ')} ecosystem.`,
    },
    {
      question: `What can I redeem ${program.name} points for?`,
      answer: `${program.name} can usually be redeemed through its own travel or cash-out channels, and in some cases through transfer partners or award charts where the value materially improves.`,
    },
    {
      question: `Do ${program.name} points expire?`,
      answer: `Expiry rules vary by program and account activity. Treat the official program terms as the source of truth before leaving a balance idle for long periods.`,
    },
  ])
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: `/${normalized}` },
    { name: 'Programs', url: `/${normalized}/programs/${program.slug}`.replace(`/${program.slug}`, '') },
    { name: program.name, url: `/${normalized}/programs/${program.slug}` },
  ], appOrigin)
  const primaryUse = program.best_uses[0] ?? (
    normalized === 'in'
      ? 'Use this program when it gives you better airline, hotel, or transfer outcomes than cashing out locally.'
      : 'Use this program when it gives you better airline, hotel, or transfer outcomes than simple cash-back.'
  )
  const workflowCards = [
    {
      href: `/${normalized}/profile`,
      title: 'Track this program in Wallet',
      description: 'Save the balance you already have so PointsMax can judge whether this program is reachable.',
    },
    {
      href: `/${normalized}/award-search`,
      title: 'Search awards before you transfer',
      description: 'Check live vs estimated availability and compare the transfer friction before you move points.',
    },
    {
      href: `/${normalized}/trip-builder`,
      title: 'Build a booking plan',
      description: 'Turn the right program into an execution-ready booking path with concrete next actions.',
    },
  ]
  const executionNotes = [
    `${program.transfer_in.length} mapped transfer-in source${program.transfer_in.length === 1 ? '' : 's'} feed this program today.`,
    `${program.transfer_out.length} mapped transfer-out partner${program.transfer_out.length === 1 ? '' : 's'} can extend its value beyond direct redemptions.`,
    normalized === 'in'
      ? 'For India, the right program often depends on whether you want premium international value, domestic convenience, or hotel leverage.'
      : 'For the US, the right program often depends on whether you want flexibility first or a tighter airline or hotel specialization.',
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <section className="pm-page-header">
        <div className="pm-shell">
          <span className="pm-pill mb-4 inline-block">Program guide {config.flag}</span>
          <h1 className="pm-heading text-4xl sm:text-5xl mb-3">{program.name}</h1>
          <p className="pm-subtle max-w-xl text-base">
            Current valuation: <strong>{program.cpp_cents.toFixed(2)}¢</strong> per point
          </p>
        </div>
      </section>
      <main className="flex-1 pm-shell py-8 space-y-8">
        <section className="pm-card-soft p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="pm-label text-pm-accent">Why this program matters</p>
              <h2 className="pm-heading text-2xl mt-3">Use {program.name} when the path is actually better than cashing out</h2>
              <p className="mt-4 text-sm leading-7 text-pm-ink-700">{primaryUse}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {workflowCards.map((card) => (
                  <Link key={card.href} href={card.href} className="rounded-2xl border border-pm-border bg-pm-surface px-4 py-4 transition-transform hover:-translate-y-0.5">
                    <p className="text-sm font-semibold text-pm-ink-900">{card.title}</p>
                    <p className="mt-2 text-sm leading-6 text-pm-ink-500">{card.description}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="pm-card p-5">
              <h3 className="pm-heading text-lg mb-3">Execution notes</h3>
              <ul className="space-y-3 text-sm leading-6 text-pm-ink-700">
                {executionNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="pm-card-soft p-5">
            <h2 className="pm-heading text-lg mb-2">Cards that earn this program</h2>
            {program.earning_cards.length === 0 ? (
              <p className="pm-subtle text-sm">No cards currently mapped for this region.</p>
            ) : (
              <ul className="space-y-2">
                {program.earning_cards.map((card) => (
                  <li key={card.id}>
                    <Link href={`/${normalized}/cards/${card.slug}`} className="text-pm-accent hover:underline text-sm">
                      {card.name}
                    </Link>
                    <span className="text-xs text-pm-ink-500"> · {card.issuer}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pm-card-soft p-5">
            <h2 className="pm-heading text-lg mb-2">Best redemption uses</h2>
            {program.best_uses.length === 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-sm text-pm-ink-700">
                <li>Premium-cabin partner flights on high cash-fare routes</li>
                <li>Peak-season hotels where cash rates spike</li>
                <li>Short-haul redemptions with favorable fixed charts</li>
              </ul>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-sm text-pm-ink-700">
                {program.best_uses.map((use) => (
                  <li key={use}>{use}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="pm-card p-5">
            <h3 className="pm-heading text-base mb-2">Transfer out partners</h3>
            {program.transfer_out.length === 0 ? (
              <p className="pm-subtle text-sm">No transfer-out partners configured.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {program.transfer_out.map((partner) => (
                  <li key={`${partner.to_program_id}-${partner.ratio_from}`}>
                    {program.name} →{' '}
                    <Link href={`/${normalized}/programs/${partner.to_program_slug}`} className="text-pm-accent hover:underline">
                      {partner.to_program_name}
                    </Link>
                    {' '}(transfer ratio {partner.ratio_from} source : {partner.ratio_to} destination)
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pm-card p-5">
            <h3 className="pm-heading text-base mb-2">Transfer in sources</h3>
            {program.transfer_in.length === 0 ? (
              <p className="pm-subtle text-sm">No transfer-in mappings configured.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {program.transfer_in.map((partner) => (
                  <li key={`${partner.from_program_id}-${partner.ratio_from}`}>
                    <Link href={`/${normalized}/programs/${partner.from_program_slug}`} className="text-pm-accent hover:underline">
                      {partner.from_program_name}
                    </Link>
                    {' '}→ {program.name} (transfer ratio {partner.ratio_from} source : {partner.ratio_to} destination)
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="pm-card p-6">
          <h2 className="pm-heading text-2xl">Next moves inside PointsMax</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Link href={`/${normalized}/calculator`} className="rounded-2xl border border-pm-border bg-pm-surface-soft p-5">
              <p className="text-sm font-semibold text-pm-ink-900">Check wallet reachability</p>
              <p className="mt-2 text-sm leading-6 text-pm-ink-500">Start with your balances and see whether {program.name} is already in play.</p>
            </Link>
            <Link href={`/${normalized}/inspire`} className="rounded-2xl border border-pm-border bg-pm-surface-soft p-5">
              <p className="text-sm font-semibold text-pm-ink-900">Browse sweet spots</p>
              <p className="mt-2 text-sm leading-6 text-pm-ink-500">Use route inspiration to understand where this kind of value shows up in practice.</p>
            </Link>
            <Link href={`/${normalized}/cards`} className="rounded-2xl border border-pm-border bg-pm-surface-soft p-5">
              <p className="text-sm font-semibold text-pm-ink-900">Find earning sources</p>
              <p className="mt-2 text-sm leading-6 text-pm-ink-500">Review the cards that feed this program before you change your wallet strategy.</p>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={createSafeJsonLdScript(jsonLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={createSafeJsonLdScript(faqJsonLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={createSafeJsonLdScript(breadcrumbJsonLd)} />
    </div>
  )
}
