import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hotel Award Search — PointsMax',
  description: 'Search hotel award availability across Hyatt, Marriott, Hilton, IHG. Find the best point redemptions.',
}

const HOTEL_PROGRAMS = [
  { name: 'World of Hyatt', slug: 'hyatt', cpp: 1.70, color: '#002147', logo: '🏨', note: 'Best hotel points value (1.7¢/pt). Standard award chart. 5-tier update May 2026.', searchUrl: 'https://www.hyatt.com/search?useRewardPoints=true', roomsAero: 'https://rooms.aero?program=hyatt' },
  { name: 'Marriott Bonvoy', slug: 'marriott', cpp: 0.75, color: '#cc0000', logo: '🏨', note: 'Largest network (30+ brands). Dynamic pricing. 5th night free on awards.', searchUrl: 'https://www.marriott.com/search/findHotels.mi', roomsAero: 'https://rooms.aero?program=marriott' },
  { name: 'Hilton Honors', slug: 'hilton', cpp: 0.40, color: '#1E3A8A', logo: '🏨', note: 'Easy to earn (Amex transfers at 1:2). 5th night free. DOWN from 0.5¢.', searchUrl: 'https://www.hilton.com/en/search/?redeemPts=true', roomsAero: 'https://rooms.aero?program=hilton' },
  { name: 'IHG One Rewards', slug: 'ihg', cpp: 0.60, color: '#6a994e', logo: '🏨', note: 'Underrated at 0.6¢. 4th night free. UP from 0.5¢.', searchUrl: 'https://www.ihg.com/hotels/us/en/find-hotels/hotel/list', roomsAero: 'https://rooms.aero?program=ihg' },
  { name: 'Choice Privileges', slug: 'choice', cpp: 0.60, color: '#0072CE', logo: '🏨', note: 'Good for budget properties. 0.6¢/pt.', searchUrl: 'https://www.choicehotels.com/use-points', roomsAero: 'https://rooms.aero?program=choice' },
]

export default function HotelSearchPage({ params }: { params: { region: string } }) {
  return (
    <div className="min-h-screen bg-pm-bg">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-pm-ink-900 mb-2">Hotel Award Search</h1>
        <p className="text-pm-ink-500 mb-8">Find the best hotel award nights across all major loyalty programs. Real-time availability powered by Rooms.aero.</p>

        {/* Quick search — link to Rooms.aero */}
        <div className="bg-pm-surface rounded-2xl border border-pm-border p-6 mb-8">
          <h2 className="text-lg font-semibold text-pm-ink-900 mb-4">Search All Programs at Once</h2>
          <p className="text-sm text-pm-ink-500 mb-4">Rooms.aero searches Hyatt, Marriott, Hilton, IHG, and Choice simultaneously — for free.</p>
          <a
            href="https://rooms.aero"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-pm-accent text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            Open Rooms.aero — Free Search ↗
          </a>
        </div>

        {/* Program cards */}
        <h2 className="text-xl font-bold text-pm-ink-900 mb-4">Search by Hotel Program</h2>
        <div className="space-y-4 mb-8">
          {HOTEL_PROGRAMS.map(prog => (
            <div key={prog.slug} className="bg-pm-surface rounded-xl border border-pm-border p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-pm-ink-900">{prog.name}</h3>
                  <p className="text-sm text-pm-ink-500 mt-1">{prog.note}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-pm-accent">{prog.cpp}¢</div>
                  <div className="text-xs text-pm-ink-400">per point</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={prog.roomsAero} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-pm-accent text-white rounded-lg text-sm font-medium hover:opacity-90">
                  Search on Rooms.aero ↗
                </a>
                <a href={prog.searchUrl} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 border border-pm-border text-pm-ink-700 rounded-lg text-sm font-medium hover:bg-pm-bg">
                  Book Direct on {prog.name.split(' ')[0]} ↗
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Value comparison bar */}
        <div className="bg-pm-surface rounded-2xl border border-pm-border p-6">
          <h2 className="text-lg font-bold text-pm-ink-900 mb-4">Hotel Points Value Comparison (TPG April 2026)</h2>
          <div className="space-y-3">
            {HOTEL_PROGRAMS.sort((a, b) => b.cpp - a.cpp).map(prog => (
              <div key={prog.slug} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium text-pm-ink-700 truncate">{prog.name.replace('World of ', '')}</div>
                <div className="flex-1 h-3 bg-pm-bg rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(prog.cpp / 1.70) * 100}%`, backgroundColor: prog.color }} />
                </div>
                <div className="w-12 text-right text-sm font-mono font-bold" style={{ color: prog.color }}>{prog.cpp}¢</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-pm-ink-400 mt-4">Source: The Points Guy April 2026 monthly valuations</p>
        </div>
      </div>
    </div>
  )
}
