import type { Metadata } from 'next'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { listProgramsForRegion } from '@/lib/programmatic-content'
import { REGIONS, type Region } from '@/lib/regions'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Loyalty Programs Directory',
  description: 'Browse loyalty program values, transfer paths, and card earn sources.',
}

type Props = {
  params: Promise<{ region: string }>
}

export default async function ProgramsIndexPage({ params }: Props) {
  const { region } = await params
  const normalized = (region === 'in' ? 'in' : 'us') as Region
  const config = REGIONS[normalized]
  const programs = await listProgramsForRegion(normalized)

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="pm-page-header">
        <div className="pm-shell">
          <span className="pm-pill mb-4 inline-block">Program directory {config.flag}</span>
          <h1 className="pm-heading text-4xl sm:text-5xl mb-3">Loyalty programs in {config.label}</h1>
          <p className="pm-subtle max-w-xl text-base">
            Valuation snapshots, transfer partners, and earning cards — {programs.length} programs tracked.
          </p>
        </div>
      </section>

      <main className="flex-1 pm-shell py-8 space-y-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((program) => (
            <Link
              key={program.id}
              href={`/${normalized}/programs/${program.slug}`}
              className="pm-card p-5 group flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-pm-ink-500">
                  {program.type.replace(/_/g, ' ')}
                </span>
                <span className="text-xs font-mono font-bold text-pm-accent bg-pm-accent-soft px-2 py-0.5 rounded-full">
                  {program.cpp_cents.toFixed(2)}¢/pt
                </span>
              </div>
              <h2 className="pm-heading text-lg leading-snug group-hover:text-pm-accent transition-colors">
                {program.name}
              </h2>
              <div className="flex items-center gap-4 text-xs text-pm-ink-500 mt-auto pt-2 border-t border-pm-border">
                <span>{program.earning_cards.length} cards</span>
                <span>{program.transfer_out.length} partners</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
