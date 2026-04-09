import dynamic from 'next/dynamic'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { getActiveCards, normalizeGeography } from '@/lib/db/cards'
import { getActivePrograms } from '@/lib/db/programs'
import { REGIONS, type Region } from '@/lib/regions'

const HeroSection = dynamic(
  () => import('./homepage-sections').then(m => m.HeroSection),
  { loading: () => <div className="h-[500px]" /> }
)

export const revalidate = 300

type PageProps = {
  params: Promise<{ region: string }>
}

export default async function LandingPage({ params }: PageProps) {
  const { region: rawRegion } = await params
  const region: Region = rawRegion === 'in' ? 'in' : 'us'

  const [cards, programs] = await Promise.all([
    getActiveCards(normalizeGeography(region)),
    getActivePrograms(region.toUpperCase() as 'US' | 'IN'),
  ])

  const cardCount = cards.length
  const programCount = programs.length
  const regionCount = Object.keys(REGIONS).length

  const US_MARQUEE_ITEMS = [
    'CHASE', 'AMERICAN EXPRESS', 'CAPITAL ONE', 'CITI', 'BILT', '•',
    'UNITED', 'DELTA', 'VIRGIN ATLANTIC', 'BRITISH AIRWAYS', 'AIR FRANCE',
  ]
  const IN_MARQUEE_ITEMS = [
    'HDFC BANK', 'AXIS BANK', 'AMERICAN EXPRESS', 'SBI CARD', '•',
    'AIR INDIA', 'CLUB VISTARA', 'SINGAPORE KRISFLYER', 'BRITISH AIRWAYS', 'QATAR AIRWAYS',
  ]
  const marqueeItems = region === 'in' ? IN_MARQUEE_ITEMS : US_MARQUEE_ITEMS

  return (
    <div className="min-h-screen bg-pm-bg flex flex-col">
      <NavBar />

      <main className="flex-1 flex flex-col w-full pt-[var(--navbar-height)] relative overflow-hidden">
        {/* Dynamic Abstract Background Elements */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center">
          <div className="absolute top-[-10%] w-[120%] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(var(--pm-accent-rgb),0.12)_0%,transparent_60%)] blur-[100px] mix-blend-screen dark:mix-blend-lighten" />
          <div className="absolute bottom-0 w-full h-[400px] bg-[linear-gradient(to_bottom,transparent_0%,var(--pm-bg)_100%)]" />
        </div>

        {/* Hero Section — client component for animations */}
        <HeroSection region={region} />

        {/* Value Prop Math Section */}
        <section className="relative z-10 py-16 sm:py-24 border-t border-pm-border-strong bg-gradient-to-b from-pm-bg to-pm-surface">
          <div className="pm-shell max-w-5xl">
            <div className="text-center mb-12">
              <span className="inline-flex rounded-full border border-pm-accent-border bg-pm-accent-soft px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-pm-accent mb-4">
                The Value Engine
              </span>
              <h2 className="pm-display text-3xl sm:text-4xl text-pm-ink-900 mb-4">
                {region === 'in' ? '1 point is not always ₹1.' : '1 point is not always 1 cent.'}
              </h2>
              <p className="text-pm-ink-500 text-lg sm:text-xl max-w-2xl mx-auto">
                Airlines hide their best value inside loyalty programs. PointsMax helps you compare
                reachable transfer paths, modeled value, and live availability when it is available.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
              {/* Bad Value */}
              <div className="pm-card p-8 rounded-3xl border border-pm-border relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/50" />
                <p className="text-sm font-semibold text-pm-ink-500 uppercase tracking-widest mb-2">
                  The Cash Portal
                </p>
                <h3 className="text-2xl font-bold pm-heading mb-6">Redeeming directly</h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-pm-ink-500">You spend</span>
                    <span className="font-bold font-mono">100,000 pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-pm-ink-500">Value flat-rate</span>
                    <span className="font-semibold text-pm-ink-900">
                      {region === 'in' ? '₹1.0 / pt' : '1.0¢ / pt'}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-pm-border flex justify-between items-end">
                    <span className="font-bold text-pm-ink-900 tracking-tight">You get</span>
                    <span className="text-3xl font-bold text-pm-ink-900 tracking-tight">
                      {region === 'in' ? '₹1,00,000 credit' : '$1,000 stmt credit'}
                    </span>
                  </div>
                </div>
              </div>

              {/* PointsMax Value */}
              <div className="pm-card p-8 rounded-3xl border border-pm-accent/30 bg-pm-accent-soft relative overflow-hidden shadow-xl shadow-pm-accent/5">
                <div className="absolute top-0 left-0 w-full h-1 bg-pm-accent" />
                <p className="text-sm font-semibold text-pm-accent uppercase tracking-widest mb-2">
                  The PointsMax Way
                </p>
                <h3 className="text-2xl font-bold pm-heading text-pm-ink-900 mb-6">
                  Transferring to partners
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-pm-ink-500">You transfer</span>
                    <span className="font-bold font-mono text-pm-ink-900">100,000 pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-pm-ink-500">Business Class value</span>
                    <span className="font-semibold text-pm-accent">
                      {region === 'in' ? '₹3.5 / pt' : '5.0¢ / pt'}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-pm-accent/20 flex justify-between items-end">
                    <span className="font-bold text-pm-ink-900 tracking-tight">You get</span>
                    <div className="text-right">
                      <span className="text-3xl font-bold text-pm-success tracking-tight">
                        {region === 'in' ? '₹3,50,000+ flight' : '$5,000+ flight'}
                      </span>
                      <p className="text-[10px] text-pm-ink-500 uppercase font-bold tracking-widest mt-0.5">
                        {region === 'in' ? 'DEL → LHR Lie-Flat' : 'JFK → LHR Lie-Flat'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 border-t border-pm-border bg-pm-surface">
          <div className="pm-shell py-16 sm:py-20">
            <div className="max-w-3xl">
              <span className="pm-pill mb-4">Built for four jobs</span>
              <h2 className="pm-display text-3xl sm:text-4xl text-pm-ink-900">
                One platform, four launch-critical workflows
              </h2>
              <p className="mt-4 text-base sm:text-lg text-pm-ink-500 max-w-2xl">
                PointsMax should feel like a real operating system for points: know what your wallet
                is worth, what it can book, which cards move you forward, and which sweet spots are
                actually worth chasing.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Link
                href={`/${region}/profile`}
                className="pm-card p-6 transition-transform hover:-translate-y-0.5"
              >
                <p className="pm-label text-pm-accent">Wallet concierge</p>
                <h3 className="pm-heading text-xl mt-3">Track the balances you can really use</h3>
                <p className="mt-3 text-sm leading-6 text-pm-ink-700">
                  Manual balances and imports keep every downstream recommendation grounded in the
                  wallet you actually have.
                </p>
              </Link>
              <Link
                href={`/${region}/award-search`}
                className="pm-card p-6 transition-transform hover:-translate-y-0.5"
              >
                <p className="pm-label text-pm-accent">Award search</p>
                <h3 className="pm-heading text-xl mt-3">
                  Search live when possible, estimate honestly when not
                </h3>
                <p className="mt-3 text-sm leading-6 text-pm-ink-700">
                  See live versus modeled trust labels, transfer friction, and wallet reachability
                  before you move a point.
                </p>
              </Link>
              <Link
                href={`/${region}/card-recommender`}
                className="pm-card p-6 transition-transform hover:-translate-y-0.5"
              >
                <p className="pm-label text-pm-accent">Card strategy</p>
                <h3 className="pm-heading text-xl mt-3">Choose cards by redemption outcomes</h3>
                <p className="mt-3 text-sm leading-6 text-pm-ink-700">
                  Use your region, spend, and goals to choose cards that feed the right programs
                  instead of generic top-10 lists.
                </p>
              </Link>
              <Link
                href={`/${region}/inspire`}
                className="pm-card p-6 transition-transform hover:-translate-y-0.5"
              >
                <p className="pm-label text-pm-accent">Playbooks</p>
                <h3 className="pm-heading text-xl mt-3">Study sweet spots before you commit</h3>
                <p className="mt-3 text-sm leading-6 text-pm-ink-700">
                  Use route inspiration and redemption examples to focus on the opportunities that
                  actually create outsized value.
                </p>
              </Link>
            </div>
          </div>
        </section>

        {/* Platform Stats */}
        <section className="relative z-10 border-t border-pm-border bg-pm-surface-soft">
          <div className="pm-shell py-12">
            <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto text-center">
              <div>
                <p className="text-3xl font-bold text-pm-ink-900">{cardCount}</p>
                <p className="text-sm text-pm-ink-500 mt-1">Cards tracked</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-pm-ink-900">{programCount}</p>
                <p className="text-sm text-pm-ink-500 mt-1">Loyalty programs</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-pm-ink-900">{regionCount}</p>
                <p className="text-sm text-pm-ink-500 mt-1">Regions supported</p>
              </div>
            </div>
          </div>
        </section>

        {/* Supported Programs Marquee */}
        <div className="py-10 border-t border-pm-border overflow-hidden bg-pm-surface-soft relative">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-pm-surface-soft to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-pm-surface-soft to-transparent z-10" />

          <div className="flex animate-[scroll_40s_linear_infinite] whitespace-nowrap opacity-60">
            {marqueeItems.map((item, idx) => (
              <span
                key={`a-${idx}`}
                className="text-xl font-bold text-pm-ink-500 tracking-tighter mx-8"
              >
                {item}
              </span>
            ))}
            {marqueeItems.map((item, idx) => (
              <span
                key={`b-${idx}`}
                className="text-xl font-bold text-pm-ink-500 tracking-tighter mx-8"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
