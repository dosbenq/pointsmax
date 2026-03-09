'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, PlaneTakeoff, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import allAirports from '@/lib/airports.json'

// Use a subset for generic client rendering if massive, but 100 is fine.
const airports = allAirports

interface AirportAutocompleteProps {
  value: string // IATA code
  onChange: (iata: string) => void
  placeholder?: string
  className?: string
  id?: string
}

export function AirportAutocomplete({
  value,
  onChange,
  placeholder = 'Select airport...',
  className,
  id
}: AirportAutocompleteProps) {
  const [open, setOpen] = React.useState(false)

  const selectedAirport = React.useMemo(() => {
    return airports.find((a) => a.iata.toUpperCase() === value.toUpperCase())
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between h-auto py-3 px-4 bg-pm-surface text-pm-ink-900 border-pm-border hover:bg-pm-surface-soft font-medium text-left transition-all',
            !selectedAirport && 'text-pm-ink-500',
            className
          )}
        >
          <div className="flex items-center gap-3 w-full truncate text-left">
             {selectedAirport ? (
                <>
                  <span className="font-bold text-pm-accent w-10 shrink-0">{selectedAirport.iata}</span>
                  <span className="truncate w-full">{selectedAirport.city} <span className="text-pm-ink-500 font-normal hidden sm:inline">({selectedAirport.name})</span></span>
                </>
             ) : (
                <>
                 <Search className="w-4 h-4 shrink-0 opacity-50" />
                 <span>{placeholder}</span>
                </>
             )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl rounded-xl border border-pm-border bg-pm-surface" sideOffset={8}>
        <Command filter={(value, search) => {
           // Custom fuzzy filter
           const searchTerms = search.toLowerCase().split(' ')
           const matchString = value.toLowerCase()
           if (searchTerms.every(term => matchString.includes(term))) return 1
           return 0
        }}>
          <CommandInput placeholder="Search city or airport code..." className="h-12 border-none ring-0 focus:ring-0" />
          <CommandList className="max-h-[300px] overflow-y-auto p-1">
            <CommandEmpty className="p-4 text-center text-sm text-pm-ink-500">
               No airports found. Try a major city like "New York" or "LHR".
            </CommandEmpty>
            <CommandGroup>
              {airports.map((airport) => (
                <CommandItem
                  key={airport.iata}
                  // We shove all searchable text into the generated value string for the filter func
                  value={`${airport.iata} ${airport.city} ${airport.name}`}
                  onSelect={(currentValue) => {
                    onChange(airport.iata)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex flex-col items-start px-4 py-3 cursor-pointer rounded-lg aria-selected:bg-pm-surface-soft aria-selected:text-pm-ink-900",
                    value.toUpperCase() === airport.iata ? "bg-pm-accent-soft text-pm-accent" : ""
                  )}
                >
                  <div className="flex items-center w-full justify-between">
                     <div className="flex items-center gap-3 w-full min-w-0">
                        <span className="font-bold w-10 shrink-0">{airport.iata}</span>
                        <div className="flex flex-col min-w-0">
                           <span className="font-semibold truncate text-[15px] leading-tight">{airport.city}</span>
                           <span className="text-xs text-pm-ink-500 truncate">{airport.name}</span>
                        </div>
                     </div>
                    {value.toUpperCase() === airport.iata && (
                      <Check className="h-4 w-4 shrink-0 text-pm-accent ml-2" />
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
