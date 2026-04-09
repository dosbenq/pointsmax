'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

const HOTEL_PROGRAMS = [
  { name: 'World of Hyatt', slug: 'hyatt', cpp: 1.70, color: '#002147', logo: '🏨', note: 'Best hotel points value (1.7¢/pt). Standard award chart. 5-tier update May 2026.', searchUrl: 'https://www.hyatt.com/search', roomsAero: 'https://rooms.aero?program=hyatt', buildUrl: (dest: string, checkIn: string, checkOut: string) => `https://www.hyatt.com/search?destination=${encodeURIComponent(dest)}&checkInDate=${checkIn}&checkOutDate=${checkOut}&useRewardPoints=true` },
  { name: 'Marriott Bonvoy', slug: 'marriott', cpp: 0.75, color: '#cc0000', logo: '🏨', note: 'Largest network (30+ brands). Dynamic pricing. 5th night free on awards.', searchUrl: 'https://www.marriott.com/search/findHotels.mi', roomsAero: 'https://rooms.aero?program=marriott', buildUrl: (dest: string, checkIn: string, checkOut: string) => `https://www.marriott.com/search/findHotels.mi?destinationAddress.destination=${encodeURIComponent(dest)}&fromDate=${checkIn}&toDate=${checkOut}` },
  { name: 'Hilton Honors', slug: 'hilton', cpp: 0.40, color: '#1E3A8A', logo: '🏨', note: 'Easy to earn (Amex transfers at 1:2). 5th night free. DOWN from 0.5¢.', searchUrl: 'https://www.hilton.com/en/search/?redeemPts=true', roomsAero: 'https://rooms.aero?program=hilton', buildUrl: (dest: string, checkIn: string, checkOut: string) => `https://www.hilton.com/en/search/?query=${encodeURIComponent(dest)}&arrivalDate=${checkIn}&departureDate=${checkOut}&redeemPts=true` },
  { name: 'IHG One Rewards', slug: 'ihg', cpp: 0.60, color: '#6a994e', logo: '🏨', note: 'Underrated at 0.6¢. 4th night free. UP from 0.5¢.', searchUrl: 'https://www.ihg.com/hotels/us/en/find-hotels/hotel/list', roomsAero: 'https://rooms.aero?program=ihg', buildUrl: (dest: string, checkIn: string, checkOut: string) => `https://www.ihg.com/hotels/us/en/find-hotels/hotel/list?qDest=${encodeURIComponent(dest)}&qCiD=${checkIn}&qCoD=${checkOut}&setPMCookies=true` },
  { name: 'Choice Privileges', slug: 'choice', cpp: 0.60, color: '#0072CE', logo: '🏨', note: 'Good for budget properties. 0.6¢/pt.', searchUrl: 'https://www.choicehotels.com/use-points', roomsAero: 'https://rooms.aero?program=choice', buildUrl: (_dest: string, _checkIn: string, _checkOut: string) => 'https://www.choicehotels.com/use-points' },
]

function getDefaultDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export default function HotelSearchPage() {
  const params = useParams()
  const region = (params?.region as string) || 'us'

  const [destination, setDestination] = useState('')
  const [checkIn, setCheckIn] = useState(getDefaultDate(14))
  const [checkOut, setCheckOut] = useState(getDefaultDate(17))
  const [maxPoints, setMaxPoints] = useState('')

  const hasSearch = destination.trim().length > 0

  function handleRoomsAeroSearch() {
    const url = new URL('https://rooms.aero')
    if (destination) url.searchParams.set('destination', destination)
    if (checkIn) url.searchParams.set('checkin', checkIn)
    if (checkOut) url.searchParams.set('checkout', checkOut)
    if (maxPoints) url.searchParams.set('max_points', maxPoints)
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-pm-bg">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-pm-ink-900 mb-2">Hotel Award Search</h1>
        <p className="text-pm-ink-500 mb-8">Find the best hotel award nights across all major loyalty programs. Real-time availability powered by Rooms.aero.</p>

        {/* Interactive Search Form */}
        <div className="bg-pm-surface rounded-2xl border border-pm-border p-6 mb-8">
          <h2 className="text-lg font-semibold text-pm-ink-900 mb-4">Search All Programs at Once</h2>
          <p className="text-sm text-pm-ink-500 mb-4">Rooms.aero searches Hyatt, Marriott, Hilton, IHG, and Choice simultaneously — for free.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-pm-ink-700 mb-1">Destination</label>
              <input
                type="text"
                placeholder="e.g. Tokyo, Paris, Goa"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="pm-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-ink-700 mb-1">Max Points (optional)</label>
              <input
                type="text"
                placeholder="e.g. 25000"
                value={maxPoints}
                onChange={(e) => setMaxPoints(e.target.value.replace(/[^\d]/g, ''))}
                className="pm-input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-pm-ink-700 mb-1">Check-in</label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="pm-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pm-ink-700 mb-1">Check-out</label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="pm-input w-full"
              />
            </div>
          </div>

          <button
            onClick={handleRoomsAeroSearch}
            className="inline-flex items-center gap-2 px-6 py-3 bg-pm-accent text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            Search on Rooms.aero — Free Search ↗
          </button>
        </div>

        {/* Program cards with direct booking links */}
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
                <a
                  href={hasSearch ? `${prog.roomsAero}&destination=${encodeURIComponent(destination)}&checkin=${checkIn}&checkout=${checkOut}` : prog.roomsAero}
                  target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-pm-accent text-white rounded-lg text-sm font-medium hover:opacity-90"
                >
                  Search on Rooms.aero ↗
                </a>
                <a
                  href={hasSearch ? prog.buildUrl(destination, checkIn, checkOut) : prog.searchUrl}
                  target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 border border-pm-border text-pm-ink-700 rounded-lg text-sm font-medium hover:bg-pm-bg"
                >
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
            {[...HOTEL_PROGRAMS].sort((a, b) => b.cpp - a.cpp).map(prog => (
              <div key={prog.slug} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium text-pm-ink-700 truncate">{prog.name.replace('World of ', '')}</div>
                <div className="flex-1 h-3 bg-pm-bg rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(prog.cpp / 1.70) * 100}%`, backgroundColor: prog.color }} />
                </div>
                <div className="w-12 text-right text-sm font-mono font-bold" style={{ color: prog.color }}>{prog.cpp}¢</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-pm-ink-400 mt-4 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Valuations: TPG April 2026
          </p>
        </div>
      </div>
    </div>
  )
}
