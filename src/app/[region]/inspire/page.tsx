import Link from 'next/link'
import type { Metadata } from 'next'
import { createServerDbClient } from '@/lib/supabase'
import type { Region } from '@/lib/regions'

type Props = {
  params: Promise<{ region: string }>
}

type InspirationRouteRow = {
  origin_iata: string | null
  destination_iata: string
  destination_label: string
  cabin: string
  program_slug: string
  miles_required: number
  estimated_cash_value_usd: number
  cpp_cents: number
  headline: string
  description: string
  is_featured: boolean
  display_order: number
}

export const revalidate = 86400

async function loadInspirationRoutes(region: Region): Promise<InspirationRouteRow[]> {
  const db = createServerDbClient()
  const regionCode = region === 'in' ? 'IN' : 'US'
  const { data, error } = await db
    .from('inspiration_routes')
    .select('origin_iata, destination_iata, destination_label, cabin, program_slug, miles_required, estimated_cash_value_usd, cpp_cents, headline, description, is_featured, display_order')
    .in('region', [regionCode, 'GLOBAL'])
    .order('display_order', { ascending: true })

  if (error) return []

  return ((data ?? []) as InspirationRouteRow[])
    .sort((left, right) => Number(right.is_featured) - Number(left.is_featured) || left.display_order - right.display_order)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params
  const routes = await loadInspirationRoutes((region === 'in' ? 'in' : 'us') as Region)
  const featured = routes.slice(0, 3).map((route) => route.headline).join(', ')
  const regionLabel = region === 'in' ? 'India' : 'US'

  return {
    title: `Redemption Inspiration — Best Award Sweet Spots | ${regionLabel} | PointsMax`,
    description: featured
      ? `Explore standout award sweet spots for ${regionLabel} travelers, including ${featured}.`
      : `Explore standout award sweet spots and redemption ideas for ${regionLabel} travelers.`,
  }
}

export default async function InspirePage({ params }: Props) {
  const { region } = await params
  const normalizedRegion = (region === 'in' ? 'in' : 'us') as Region
  const routes = await loadInspirationRoutes(normalizedRegion)

  return (
    <div className="min-h-screen bg-pm-bg">
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="pm-label text-pm-accent">Redemption inspiration</p>
          <h1 className="pm-display mt-3 text-4xl text-pm-ink-900 sm:text-5xl">
            Award sweet spots worth chasing
          </h1>
          <p className="mt-4 text-base text-pm-ink-500 sm:text-lg">
            Curated examples of routes where points can materially outperform paying cash.
          </p>
        </div>

        {routes.length === 0 ? (
          <div className="mt-12 rounded-[28px] border border-pm-border bg-pm-surface p-8 text-center text-sm text-pm-ink-500">
            Inspiration routes are being loaded for this region.
          </div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {routes.map((route, index) => {
              const searchParams = new URLSearchParams({
                destination: route.destination_iata,
                cabin: route.cabin,
              })
              if (route.origin_iata) {
                searchParams.set('origin', route.origin_iata)
              }

              return (
                <article
                  key={`${route.program_slug}-${route.destination_iata}-${index}`}
                  className="overflow-hidden rounded-[28px] border border-pm-border bg-pm-surface shadow-sm"
                >
                  <div className="bg-[radial-gradient(circle_at_top_right,rgba(var(--pm-accent-rgb),0.18),transparent_55%),linear-gradient(135deg,#f4f7fb,#ffffff)] px-6 py-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="pm-label text-pm-accent">{route.destination_label}</p>
                        <h2 className="mt-2 text-2xl font-semibold text-pm-ink-900">{route.headline}</h2>
                      </div>
                      {route.is_featured && (
                        <span className="rounded-full border border-pm-accent-border bg-pm-accent-soft px-3 py-1 text-xs font-medium text-pm-accent">
                          Featured
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="px-6 py-6">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                        <p className="text-pm-ink-500">Value</p>
                        <p className="mt-1 font-semibold text-pm-success-strong">{route.cpp_cents.toFixed(1)}¢/pt</p>
                      </div>
                      <div className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                        <p className="text-pm-ink-500">Miles</p>
                        <p className="mt-1 font-semibold text-pm-ink-900">{route.miles_required.toLocaleString()}</p>
                      </div>
                      <div className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                        <p className="text-pm-ink-500">Est. cash fare</p>
                        <p className="mt-1 font-semibold text-pm-ink-900">${route.estimated_cash_value_usd.toLocaleString()}</p>
                      </div>
                      <div className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                        <p className="text-pm-ink-500">Cabin</p>
                        <p className="mt-1 font-semibold capitalize text-pm-ink-900">{route.cabin.replace('_', ' ')}</p>
                      </div>
                    </div>

                    <p className="mt-5 text-sm leading-6 text-pm-ink-600">{route.description}</p>

                    <Link
                      href={`/${normalizedRegion}/award-search?${searchParams.toString()}`}
                      className="mt-6 inline-flex items-center rounded-full border border-pm-accent-border bg-pm-accent-soft px-4 py-2 text-sm font-medium text-pm-accent transition hover:bg-pm-accent hover:text-white"
                    >
                      Search this route →
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
