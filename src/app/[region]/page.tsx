import { Suspense } from 'react'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { getCatalogPrograms } from '@/lib/catalog'
import { SearchScreen, type WalletProgram } from './search-screen'

type PageProps = {
  params: Promise<{ region: string }>
}

// The region home is the product: your points, your trip, what you can book.
export default async function RegionHome({ params }: PageProps) {
  const { region: rawRegion } = await params
  const region = rawRegion === 'in' ? 'in' : 'us'

  const programs: WalletProgram[] = getCatalogPrograms({ geography: region.toUpperCase() as 'US' | 'IN' })
    .filter((program) => program.type === 'transferable_points' || program.type === 'airline_miles')
    .map((program) => ({
      id: program.id,
      name: program.name,
      kind: program.type === 'transferable_points' ? ('bank' as const) : ('airline' as const),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex min-h-screen flex-col bg-pm-bg">
      <NavBar />
      <main className="flex-1 pt-[var(--navbar-height)]">
        <Suspense>
          <SearchScreen region={region} programs={programs} />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
