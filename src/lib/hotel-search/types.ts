import type { SupabaseClient } from '@supabase/supabase-js'

export type HotelDestinationRegion =
  | 'north_america'
  | 'europe'
  | 'middle_east_africa'
  | 'asia_pacific'
  | 'latin_america'
  | 'india'

export interface HotelSearchParams {
  destination_region: HotelDestinationRegion
  check_in: string
  check_out: string
  balances: Array<{ program_id: string; amount: number }>
}

export interface HotelSearchResult {
  program_slug: string
  program_name: string
  chain: string
  tier_label: string
  tier_number: number
  nights: number
  points_off_peak_total: number | null
  points_standard_total: number
  points_peak_total: number | null
  estimated_cash_value_usd: number
  cpp_cents: number
  transfer_chain: string | null
  transfer_is_instant: boolean
  transfer_time_max_hrs: number
  is_reachable: boolean
  points_needed_from_wallet: number
  booking_url: string | null
}

export interface HotelAwardProvider {
  search(params: HotelSearchParams, client: SupabaseClient): Promise<HotelSearchResult[]>
}

export type HotelProgramRow = {
  id: string
  slug: string
  name: string
  chain: string
  booking_url: string | null
  color_hex: string | null
}

export type HotelAwardChartRow = {
  program_id: string
  destination_region: HotelDestinationRegion
  tier_label: string
  tier_number: number
  points_off_peak: number | null
  points_standard: number
  points_peak: number | null
  estimated_cash_usd: number
}
