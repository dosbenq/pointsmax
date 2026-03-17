// ============================================================
// Award Search — Shared types
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first'

export type RouteRegion =
  | 'domestic_us'
  | 'domestic_india'
  | 'canada_mexico'
  | 'caribbean'
  | 'europe'
  | 'middle_east'
  | 'japan_korea'
  | 'se_asia'
  | 'australia'
  | 'south_america'
  | 'other'

export interface AwardSearchParams {
  origin: string           // IATA e.g. "JFK"
  destination: string      // IATA e.g. "NRT"
  cabin: CabinClass
  passengers: number       // 1–9
  start_date: string       // YYYY-MM-DD
  end_date: string         // YYYY-MM-DD
  balances: Array<{ program_id: string; amount: number }>
}

export interface AwardSearchResult {
  program_slug: string
  program_name: string
  program_color: string
  estimated_miles: number
  estimated_cash_value_cents: number
  cpp_cents: number
  baseline_cpp_cents: number
  cash_value_source: 'modeled_route_fare' | 'live_fare_api' | 'static_program_cpp'
  cash_value_confidence: 'low' | 'medium' | 'high'
  transfer_chain: string | null           // e.g. "Chase UR → Aeroplan (1:1)"
  transfer_is_instant: boolean
  points_needed_from_wallet: number
  availability: {
    date: string
    available: boolean
    source: 'seats_aero'
  } | null
  deep_link: { url: string; label: string; note?: string }
  has_real_availability: boolean
  is_reachable: boolean
}

export interface AwardNarrative {
  headline: string
  body: string
  top_pick_slug: string
  warnings: string[]
  booking_tips: string[]
}

export interface AwardSearchResponse {
  provider: 'stub' | 'seats_aero'
  params: AwardSearchParams
  results: AwardSearchResult[]
  ai_narrative: AwardNarrative | null
  warnings?: string[]
  searched_at: string
  error?: 'real_availability_unavailable'
  message?: string
}

export interface AwardProvider {
  readonly name: 'stub' | 'seats_aero'
  search(params: AwardSearchParams, client: SupabaseClient): Promise<AwardSearchResult[]>
}

// Raw DB rows used by providers
export interface ProgramRow {
  id: string
  name: string
  short_name: string
  slug: string
  color_hex: string
  type: string
}

export interface TransferPartnerRow {
  id: string
  from_program_id: string
  to_program_id: string
  ratio_from: number
  ratio_to: number
  is_instant: boolean
  transfer_time_max_hrs: number
}

export interface ValuationRow {
  program_id: string
  cpp_cents: number
  program_name: string
  program_slug: string
  program_type: string
}
