// ============================================================
// HotelResults
// UI for the hotel search tab (stub backend)
// ============================================================

'use client'

import { format, parseISO, isBefore, startOfToday } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon, Search, Building2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HotelParams } from '../hooks/use-calculator-state'

interface HotelResultsProps {
  hotelParams: HotelParams
  setHotelParams: React.Dispatch<React.SetStateAction<HotelParams>>
}

export function HotelResults({
  hotelParams,
  setHotelParams,
}: HotelResultsProps) {
  return (
    <div className="flex flex-col">
      {/* Top: Form Inputs */}
      <div className="p-8 lg:p-10 space-y-6 bg-pm-surface">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl">🏨</span>
          <h2 className="pm-heading text-lg">Find Award Hotels</h2>
          <span className="pm-pill ml-2">Coming Soon</span>
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
            <Popover>
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
            <Popover>
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
          disabled={true}
          className="pm-button w-full opacity-50 cursor-not-allowed group/btn overflow-hidden"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <Search className="w-4 h-4" /> 
            Search Award Hotels
          </span>
          <div className="absolute inset-0 bg-pm-ink-900/10 -translate-x-full group-hover/btn:translate-x-0 transition-transform duration-300" />
        </button>
        <p className="text-center text-xs text-pm-ink-500 mt-2">
            Live hotel award search is currently in development.
        </p>
      </div>
    </div>
  )
}
