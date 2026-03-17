import type { CabinClass, RouteRegion } from './types'

const ONE_WAY_FARE_BENCHMARKS_USD: Record<RouteRegion, Partial<Record<CabinClass, number>>> = {
  domestic_us: {
    economy: 180,
    premium_economy: 320,
    business: 520,
    first: 900,
  },
  domestic_india: {
    economy: 95,
    premium_economy: 160,
    business: 250,
    first: 420,
  },
  canada_mexico: {
    economy: 260,
    premium_economy: 420,
    business: 780,
    first: 1200,
  },
  caribbean: {
    economy: 280,
    premium_economy: 450,
    business: 820,
    first: 1250,
  },
  europe: {
    economy: 520,
    premium_economy: 980,
    business: 2800,
    first: 5200,
  },
  middle_east: {
    economy: 700,
    premium_economy: 1300,
    business: 3600,
    first: 6800,
  },
  japan_korea: {
    economy: 760,
    premium_economy: 1450,
    business: 3900,
    first: 7200,
  },
  se_asia: {
    economy: 820,
    premium_economy: 1550,
    business: 4200,
    first: 7800,
  },
  australia: {
    economy: 980,
    premium_economy: 1750,
    business: 4700,
    first: 8600,
  },
  south_america: {
    economy: 620,
    premium_economy: 1100,
    business: 3000,
    first: 5600,
  },
  other: {
    economy: 650,
    premium_economy: 1200,
    business: 3200,
    first: 6000,
  },
}

export type RedemptionValueModel = {
  cashValueCents: number
  cppCents: number
  source: 'modeled_route_fare'
  confidence: 'low' | 'medium'
}

export function estimateAwardCashValue(args: {
  routeRegion: RouteRegion
  cabin: CabinClass
  passengers: number
  estimatedMiles: number
  hasRealAvailability: boolean
}): RedemptionValueModel | null {
  const cabinBenchmarks = ONE_WAY_FARE_BENCHMARKS_USD[args.routeRegion] ?? ONE_WAY_FARE_BENCHMARKS_USD.other
  const baseFareUsd = cabinBenchmarks[args.cabin]

  if (typeof baseFareUsd !== 'number' || !Number.isFinite(baseFareUsd) || !Number.isFinite(args.estimatedMiles) || args.estimatedMiles <= 0) {
    return null
  }

  const passengers = Number.isFinite(args.passengers) && args.passengers > 0 ? args.passengers : 1
  const cashValueCents = Math.round(baseFareUsd * 100 * passengers)
  const cppCents = cashValueCents / args.estimatedMiles

  return {
    cashValueCents,
    cppCents,
    source: 'modeled_route_fare',
    confidence: args.hasRealAvailability ? 'medium' : 'low',
  }
}
