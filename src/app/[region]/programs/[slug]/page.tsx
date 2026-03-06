import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { getProgramBySlug, listProgramsForRegion } from '@/lib/programmatic-content'
import { REGIONS, type Region } from '@/lib/regions'
import { generateProgramJsonLd } from '@/lib/seo'

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
  return {
    title: `${program.name} — Current Point Value & Transfer Partners | PointsMax`,
    description: `${program.name} valuation, transfer partners, earning cards, and best redemption uses.`,
  }
}

export default async function ProgramDetailPage({ params }: Props) {
  const { region, slug } = await params
  const normalized = normalizeRegion(region)
  const config = REGIONS[normalized]
  const program = await getProgramBySlug(normalized, slug)
  if (!program) notFound()

  const jsonLd = generateProgramJsonLd({
    name: program.name,
    description: `${program.name} valuation and transfer partner guide on PointsMax.`,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://pointsmax.com'}/${normalized}/programs/${program.slug}`,
  })

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
                    {' '}({partner.ratio_from}:{partner.ratio_to})
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
                    {' '}→ {program.name} ({partner.ratio_from}:{partner.ratio_to})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}
