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
      <main className="flex-1 pm-shell py-12 space-y-6">
        <div>
          <span className="pm-pill">Program directory {config.flag}</span>
          <h1 className="pm-heading text-3xl mt-3">Loyalty programs in {config.label}</h1>
          <p className="pm-subtle mt-2">
            Current valuation snapshots, transfer edges, and connected earning cards.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((program) => (
            <Link key={program.id} href={`/${normalized}/programs/${program.slug}`} className="pm-card-soft p-5 hover:shadow-md transition-shadow">
              <p className="text-xs text-[#5f7c70] uppercase">{program.type.replace(/_/g, ' ')}</p>
              <h2 className="pm-heading text-lg mt-1">{program.name}</h2>
              <p className="text-sm text-[#4a6a5d] mt-2">
                Valuation: {program.cpp_cents.toFixed(2)}¢ / point
              </p>
              <p className="text-sm text-[#4a6a5d] mt-1">
                Earning cards: {program.earning_cards.length}
              </p>
              <p className="text-sm text-[#4a6a5d] mt-1">
                Transfer partners: {program.transfer_out.length}
              </p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
