import { notFound } from 'next/navigation'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { createServerDbClient } from '@/lib/supabase'
import { type Region, REGIONS } from '@/lib/regions'

type Props = {
  params: Promise<{ region: string; id: string }>
}

type SharedTripRow = {
  id: string
  region: string
  trip_data: Record<string, unknown>
  created_at: string
}

function normalizeRegion(region: string): Region {
  return region === 'in' ? 'in' : 'us'
}

function asNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export default async function SharedTripPage({ params }: Props) {
  const { region, id } = await params
  const normalized = normalizeRegion(region)
  const config = REGIONS[normalized]
  const db = createServerDbClient()

  const { data, error } = await db
    .from('shared_trips')
    .select('id, region, trip_data, created_at')
    .eq('id', id)
    .eq('region', normalized)
    .maybeSingle()

  if (error || !data) notFound()
  const trip = data as SharedTripRow
  const snapshot = trip.trip_data ?? {}

  const destination = typeof snapshot.destination === 'string' ? snapshot.destination : 'Unknown destination'
  const topProgram = typeof snapshot.top_program === 'string' ? snapshot.top_program : 'Best available program'
  const pointsUsed = asNumber(snapshot.points_used)
  const totalValue = asNumber(snapshot.total_value_cents)
  const redemptionCount = asNumber(snapshot.results_count)

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 pm-shell py-12 space-y-6">
        <div>
          <span className="pm-pill">Shared trip {config.flag}</span>
          <h1 className="pm-heading text-3xl mt-3">Points strategy snapshot</h1>
          <p className="pm-subtle mt-2">
            Shared from PointsMax on {new Date(trip.created_at).toLocaleDateString()}.
          </p>
        </div>

        <section className="grid sm:grid-cols-3 gap-4">
          <div className="pm-card p-4">
            <p className="text-xs text-pm-ink-500">Destination</p>
            <p className="text-xl font-semibold text-pm-ink-900 mt-1">{destination}</p>
          </div>
          <div className="pm-card p-4">
            <p className="text-xs text-pm-ink-500">Points used</p>
            <p className="text-xl font-semibold text-pm-ink-900 mt-1">{pointsUsed.toLocaleString()}</p>
          </div>
          <div className="pm-card p-4">
            <p className="text-xs text-pm-ink-500">Estimated value saved</p>
            <p className="text-xl font-semibold text-pm-ink-900 mt-1">
              {(totalValue / 100).toLocaleString('en-US', {
                style: 'currency',
                currency: config.currency,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </section>

        <section className="pm-card-soft p-6">
          <h2 className="pm-heading text-xl mb-2">Top redemption path</h2>
          <p className="pm-subtle text-sm">
            Program: <strong>{topProgram}</strong> · Options considered: <strong>{redemptionCount}</strong>
          </p>
          <p className="pm-subtle text-sm mt-2">
            Want your own personalized plan? Open PointsMax calculator and run your wallet through live ranking.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}
