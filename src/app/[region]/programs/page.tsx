import type { Metadata } from 'next'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { listProgramsForRegion } from '@/lib/programmatic-content'
import { REGIONS, type Region } from '@/lib/regions'
import { DataFreshness } from '@/components/ui/DataFreshness'

export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params
  const label = region === 'in' ? 'India' : 'US'
  return {
    title: `Loyalty Programs Directory — ${label}`,
    description: `Browse ${label} loyalty program values, transfer paths, and card earn sources.`,
    alternates: {
      canonical: `/${region}/programs`,
    },
  }
}

type Props = {
  params: Promise<{ region: string }>
}

export default async function ProgramsIndexPage({ params }: Props) {
  const { region } = await params
  const normalized = (region === 'in' ? 'in' : 'us') as Region
  const config = REGIONS[normalized]
  const programs = await listProgramsForRegion(normalized)
  const groupedPrograms = programs.reduce<Record<string, typeof programs>>((acc, program) => {
    const type = program.type.replace(/_/g, ' ')
    acc[type] = acc[type] ?? []
    acc[type].push(program)
    return acc
  }, {})
  const transferReadyPrograms = programs.filter((program) => program.transfer_in.length > 0 || program.transfer_out.length > 0).length
  const quickActions = [
    {
      href: `/${normalized}/calculator`,
      title: 'See what your points can book',
      description: 'Start with your balances and let the valuation engine show which programs are worth your attention.',
    },
    {
      href: `/${normalized}/award-search`,
      title: 'Search award space',
      description: 'Check routes, trust-state labels, and transfer paths before you move any points.',
    },
    {
      href: `/${normalized}/trip-builder`,
      title: 'Build my plan',
      description: 'Move from the right program into a concrete, step-by-step execution path.',
    },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="pm-page-header">
        <div className="pm-shell">
          <span className="pm-pill mb-4 inline-block">Program directory {config.flag}</span>
          <h1 className="pm-heading text-4xl sm:text-5xl mb-3">Loyalty programs in {config.label}</h1>
          <p className="pm-subtle max-w-xl text-base">
            Valuation snapshots, transfer partners, and earning cards — {programs.length} programs tracked for real wallet and booking decisions.
          </p>
          <div className="mt-3">
            <DataFreshness />
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="pm-card-soft p-5">
              <p className="pm-label">Tracked programs</p>
              <p className="mt-2 text-3xl font-bold text-pm-ink-900">{programs.length}</p>
              <p className="mt-2 text-sm text-pm-ink-500">Across cards, airlines, and hotels mapped for {config.label}.</p>
            </div>
            <div className="pm-card-soft p-5">
              <p className="pm-label">Transfer-ready programs</p>
              <p className="mt-2 text-3xl font-bold text-pm-ink-900">{transferReadyPrograms}</p>
              <p className="mt-2 text-sm text-pm-ink-500">Programs with at least one mapped transfer path in or out.</p>
            </div>
            <div className="pm-card-soft p-5">
              <p className="pm-label">Region focus</p>
              <p className="mt-2 text-2xl font-bold text-pm-ink-900">{config.label}</p>
              <p className="mt-2 text-sm text-pm-ink-500">
                {normalized === 'in'
                  ? 'Built around Indian bank points, airline miles, and hotel programs that matter locally.'
                  : 'Built around transferable currencies and the airline and hotel partners US travelers actually use.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 pm-shell py-8 space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="pm-card p-5 transition-transform hover:-translate-y-0.5">
              <p className="pm-label text-pm-accent">{action.title}</p>
              <p className="mt-3 text-sm leading-6 text-pm-ink-700">{action.description}</p>
              <p className="mt-4 text-sm font-semibold text-pm-accent">Open workflow →</p>
            </Link>
          ))}
        </div>

        {Object.entries(groupedPrograms).map(([type, typePrograms]) => (
          <section key={type} className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="pm-label">{type}</p>
                <h2 className="pm-heading text-2xl mt-2 capitalize">{type}</h2>
              </div>
              <p className="text-sm text-pm-ink-500">{typePrograms.length} tracked</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {typePrograms.map((program) => (
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
                  <p className="text-sm leading-6 text-pm-ink-700">
                    {program.best_uses[0] ?? 'Use this page to judge where the program shines, what feeds it, and how to deploy it.'}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-pm-ink-500 mt-auto pt-2 border-t border-pm-border">
                    <span>{program.earning_cards.length} cards</span>
                    <span>{program.transfer_out.length} out</span>
                    <span>{program.transfer_in.length} in</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section className="pm-card-soft p-8 sm:p-10">
          <h2 className="pm-heading text-2xl">Programs are only useful when they lead to bookings</h2>
          <p className="pm-subtle mt-3 max-w-3xl">
            Use these guides to decide which ecosystems deserve more of your spend, which transfers are worth the friction,
            and whether a program actually helps you reach the routes and hotels you care about.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/${normalized}/how-it-works`} className="pm-button-secondary">
              How PointsMax works
            </Link>
            <Link href={`/${normalized}/inspire`} className="pm-button-secondary">
              Explore award playbooks
            </Link>
            <Link href={`/${normalized}/calculator`} className="pm-button">
              Start with my balances
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
