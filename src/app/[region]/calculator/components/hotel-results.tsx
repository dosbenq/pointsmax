// ============================================================
// HotelResults
// UI for the hotel search tab
// ============================================================

'use client'

import { useState } from 'react'
import { format, parseISO, isBefore, startOfToday } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon, Search, Building2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getHotelBookingUrl } from '@/lib/hotel-search/deep-links'
import type { HotelDestinationRegion, HotelSearchResult } from '@/lib/hotel-search'
import type { BalanceRow, HotelParams } from '../hooks/use-calculator-state'

interface HotelResultsProps {
  hotelParams: HotelParams
  setHotelParams: React.Dispatch<React.SetStateAction<HotelParams>>
  rows: BalanceRow[]
}

const DESTINATION_REGION_KEYWORDS: Array<{ region: HotelDestinationRegion; keywords: string[] }> = [
  { region: 'india', keywords: ['india', 'delhi', 'mumbai', 'goa', 'jaipur', 'bangalore', 'bengaluru', 'udaipur'] },
  { region: 'north_america', keywords: ['new york', 'hawaii', 'miami', 'los angeles', 'toronto', 'vancouver', 'mexico', 'canada', 'usa'] },
  { region: 'europe', keywords: ['london', 'paris', 'rome', 'madrid', 'amsterdam', 'zurich', 'europe'] },
  { region: 'middle_east_africa', keywords: ['dubai', 'abu dhabi', 'doha', 'cairo', 'nairobi', 'africa', 'middle east'] },
  { region: 'latin_america', keywords: ['cancun', 'mexico city', 'buenos aires', 'rio', 'sao paulo', 'latin america'] },
]

function resolveDestinationRegion(destination: string): HotelDestinationRegion {
  const normalized = destination.trim().toLowerCase()
  if (!normalized) return 'asia_pacific'
  const match = DESTINATION_REGION_KEYWORDS.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword)),
  )
  return match?.region ?? 'asia_pacific'
}

function parsePointsInput(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, '')
  if (!digitsOnly) return 0
  return Number.parseInt(digitsOnly, 10)
}

function closeDatePopover(setOpen: (open: boolean) => void) {
  window.setTimeout(() => {
    setOpen(false)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, 0)
}

export function HotelResults({
  hotelParams,
  setHotelParams,
  rows,
}: HotelResultsProps) {
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [checkOutOpen, setCheckOutOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<HotelSearchResult[]>([])
  const [destinationRegion, setDestinationRegion] = useState<HotelDestinationRegion | null>(null)

  const walletBalances = rows
    .filter((row) => row.program_id && row.amount)
    .map((row) => ({
      program_id: row.program_id,
      amount: parsePointsInput(row.amount),
    }))
    .filter((balance) => balance.amount > 0)

  async function handleSearch() {
    if (!hotelParams.destination || !hotelParams.start_date || !hotelParams.end_date) {
      setError('Choose a destination and dates before searching.')
      return
    }

    const resolvedRegion = resolveDestinationRegion(hotelParams.destination)
    setDestinationRegion(resolvedRegion)
    setSearching(true)
    setError(null)

    try {
      const response = await fetch('/api/hotel-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_region: resolvedRegion,
          check_in: hotelParams.start_date,
          check_out: hotelParams.end_date,
          balances: walletBalances,
        }),
      })

      const payload = await response.json().catch(() => ({})) as {
        results?: HotelSearchResult[]
        error?: { message?: string }
      }

      if (!response.ok) {
        throw new Error(payload.error?.message || 'Hotel search failed')
      }

      setResults(payload.results ?? [])
    } catch (searchError) {
      setResults([])
      setError(searchError instanceof Error ? searchError.message : 'Hotel search failed')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="p-8 lg:p-10 space-y-6 bg-pm-surface">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl">🏨</span>
          <h2 className="pm-heading text-lg">Find Award Hotels</h2>
          <span className="pm-pill ml-2">Chart-based</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="pm-label block mb-1.5">Destination</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pm-ink-500" />
              <input
                type="text"
                placeholder="City, landmark, or region"
                value={hotelParams.destination}
                onChange={(e) => setHotelParams(p => ({ ...p, destination: e.target.value }))}
                className="pm-input w-full pl-10"
              />
            </div>
          </div>
          <div>
            <label className="pm-label block mb-1.5">Hotel Name (Optional)</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pm-ink-500" />
              <input
                type="text"
                placeholder="e.g. Park Hyatt Tokyo"
                value={hotelParams.hotel_name}
                onChange={(e) => setHotelParams(p => ({ ...p, hotel_name: e.target.value }))}
                className="pm-input w-full pl-10"
              />
            </div>
          </div>
        </div>

        {/* Date Pickers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="pm-label block mb-1.5">Check In</label>
            <Popover open={checkInOpen} onOpenChange={setCheckInOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal pm-input bg-pm-surface hover:bg-pm-surface-soft',
                    !hotelParams.start_date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-pm-ink-500" />
                  {hotelParams.start_date ? format(parseISO(hotelParams.start_date), 'PP') : <span>Pick date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-pm-surface" align="start">
                <Calendar
                  mode="single"
                  selected={hotelParams.start_date ? parseISO(hotelParams.start_date) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      const isoDate = format(date, 'yyyy-MM-dd')
                      setHotelParams((p) => {
                        const shouldClearEnd = !!p.end_date && p.end_date <= isoDate
                        return {
                          ...p,
                          start_date: isoDate,
                          end_date: shouldClearEnd ? '' : p.end_date,
                        }
                      })
                      closeDatePopover(setCheckInOpen)
                    }
                  }}
                  disabled={(date) => isBefore(date, startOfToday())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="pm-label block mb-1.5">Check Out</label>
            <Popover open={checkOutOpen} onOpenChange={setCheckOutOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal pm-input bg-pm-surface hover:bg-pm-surface-soft',
                    !hotelParams.end_date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-pm-ink-500" />
                  {hotelParams.end_date ? format(parseISO(hotelParams.end_date), 'PP') : <span>Pick date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-pm-surface" align="start">
                <Calendar
                  mode="single"
                  selected={hotelParams.end_date ? parseISO(hotelParams.end_date) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setHotelParams((p) => ({ ...p, end_date: format(date, 'yyyy-MM-dd') }))
                      closeDatePopover(setCheckOutOpen)
                    }
                  }}
                  disabled={(date) => {
                    const minDate = hotelParams.start_date ? parseISO(hotelParams.start_date) : startOfToday()
                    return isBefore(date, minDate)
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="pm-button w-full group/btn overflow-hidden disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <Search className="w-4 h-4" /> 
            {searching ? 'Searching Hotels…' : 'Search Award Hotels'}
          </span>
          <div className="absolute inset-0 bg-pm-ink-900/10 -translate-x-full group-hover/btn:translate-x-0 transition-transform duration-300" />
        </button>

        <div className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3 text-xs text-pm-ink-500">
          Hotels are chart-based right now. We rank likely award options from Hyatt, Marriott, and Hilton using the region you search and the balances already in your wallet.
        </div>

        {walletBalances.length === 0 && (
          <p className="text-xs text-pm-ink-500">
            Add a transferable or hotel balance in the wallet first if you want reachability and transfer-path guidance.
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>

      <div className="p-8 lg:p-10 border-t border-pm-border bg-pm-surface-soft">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="pm-label">Hotel award options</p>
            <p className="text-sm text-pm-ink-500 mt-1">
              {destinationRegion ? `Showing chart-based options for ${destinationRegion.replace(/_/g, ' ')}.` : 'Search a destination to see ranked hotel award options.'}
            </p>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-dashed border-pm-border bg-pm-surface p-8 text-center text-sm text-pm-ink-500">
            No hotel results yet. Try a different destination region or add a transferable balance that can reach Hyatt, Marriott, or Hilton.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {results.map((result) => {
              const bookingUrl = getHotelBookingUrl(result.program_slug, result.booking_url)
              return (
                <div key={`${result.program_slug}-${result.tier_number}`} className="rounded-[28px] border border-pm-border bg-pm-surface p-6 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-pm-ink-500">{result.chain}</p>
                      <h3 className="mt-2 text-2xl font-bold text-pm-ink-900">{result.program_name}</h3>
                      <p className="mt-2 text-sm text-pm-ink-500">
                        {result.tier_label} for {result.nights} night{result.nights === 1 ? '' : 's'}
                      </p>
                      <p className="mt-2 text-sm text-pm-ink-500">
                        {result.transfer_chain ?? 'Use your existing hotel balance directly.'}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[440px]">
                      <div className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500">Points</p>
                        <p className="mt-1 text-xl font-bold text-pm-ink-900">{result.points_standard_total.toLocaleString()}</p>
                        <p className="mt-1 text-xs text-pm-ink-500">
                          {result.points_off_peak_total ? `${result.points_off_peak_total.toLocaleString()} off-peak` : 'Standard chart'}
                          {result.points_peak_total ? ` · ${result.points_peak_total.toLocaleString()} peak` : ''}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500">Est. Cash</p>
                        <p className="mt-1 text-xl font-bold text-pm-ink-900">${result.estimated_cash_value_usd.toLocaleString()}</p>
                        <p className="mt-1 text-xs text-pm-ink-500">{result.cpp_cents.toFixed(1)}¢/pt</p>
                      </div>
                      <div className="rounded-2xl border border-pm-border bg-pm-surface-soft px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-pm-ink-500">Wallet Fit</p>
                        <p className={`mt-1 text-xl font-bold ${result.is_reachable ? 'text-pm-success' : 'text-pm-ink-900'}`}>
                          {result.is_reachable ? 'Reachable' : 'Needs more'}
                        </p>
                        <p className="mt-1 text-xs text-pm-ink-500">
                          Need {result.points_needed_from_wallet.toLocaleString()} from your wallet
                        </p>
                      </div>
                    </div>
                  </div>

                  {bookingUrl && (
                    <div className="mt-5 flex justify-end">
                      <a
                        href={bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pm-button-secondary"
                      >
                        Book via {result.chain}
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
