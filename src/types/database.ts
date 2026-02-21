// ============================================================
// PointsMax — Database Types
// Mirror of the PostgreSQL schema for TypeScript type safety
// ============================================================

export type ProgramType =
  | 'transferable_points'
  | 'airline_miles'
  | 'hotel_points'
  | 'cashback'

export type RedemptionCategory =
  | 'transfer_partner'
  | 'travel_portal'
  | 'statement_credit'
  | 'cashback'
  | 'gift_cards'
  | 'pay_with_points'

export type ValuationSource = 'tpg' | 'nerdwallet' | 'manual'

export type SubscriptionTier = 'free' | 'premium'

// ─────────────────────────────────────────────
// RAW TABLE ROWS (match DB columns exactly)
// ─────────────────────────────────────────────

export interface Program {
  id: string
  name: string
  short_name: string
  slug: string
  type: ProgramType
  issuer: string | null
  logo_url: string | null
  color_hex: string
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface Valuation {
  id: string
  program_id: string
  cpp_cents: number          // e.g. 2.05 = 2.05 cents per point
  source: ValuationSource
  source_url: string | null
  effective_date: string
  notes: string | null
  created_at: string
}

export interface TransferPartner {
  id: string
  from_program_id: string
  to_program_id: string
  ratio_from: number         // e.g. 250 (send 250 points)
  ratio_to: number           // e.g. 200 (receive 200 miles)
  min_transfer: number
  transfer_increment: number
  transfer_time_min_hrs: number
  transfer_time_max_hrs: number
  is_instant: boolean
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TransferBonus {
  id: string
  transfer_partner_id: string
  bonus_pct: number          // e.g. 30 = 30% extra miles
  start_date: string
  end_date: string
  source_url: string | null
  is_verified: boolean
  notes: string | null
  created_at: string
}

export interface RedemptionOption {
  id: string
  program_id: string
  category: RedemptionCategory
  cpp_cents: number
  label: string
  notes: string | null
  updated_at: string
}

export interface User {
  id: string
  email: string
  tier: SubscriptionTier
  stripe_customer_id: string | null
  created_at: string
}

export interface UserBalance {
  id: string
  user_id: string
  program_id: string
  balance: number
  updated_at: string
}

export interface AlertSubscription {
  id: string
  email: string
  user_id: string | null
  program_ids: string[]
  is_active: boolean
  created_at: string
}

// ─────────────────────────────────────────────
// VIEW ROWS (joined/computed from DB views)
// ─────────────────────────────────────────────

export interface LatestValuation extends Valuation {
  program_name: string
  program_slug: string
  program_type: ProgramType
}

export interface ActiveBonus extends TransferBonus {
  from_program_id: string
  to_program_id: string
  ratio_from: number
  ratio_to: number
  from_program_name: string
  from_program_slug: string
  to_program_name: string
  to_program_slug: string
  is_active_now: boolean
}

// ─────────────────────────────────────────────
// DOMAIN TYPES (used in business logic / API responses)
// ─────────────────────────────────────────────

/** A single user-entered balance */
export interface BalanceInput {
  program_id: string
  amount: number
}

/** One redemption option with computed dollar value */
export interface RedemptionResult {
  label: string                  // "Transfer to Hyatt" or "Chase Travel Portal"
  category: RedemptionCategory
  from_program: Pick<Program, 'id' | 'name' | 'short_name' | 'slug' | 'color_hex'>
  to_program?: Pick<Program, 'id' | 'name' | 'short_name' | 'slug' | 'color_hex'>
  points_in: number              // points you put in
  points_out: number             // points/miles you receive (after transfer ratio)
  cpp_cents: number              // effective cents per point
  total_value_cents: number      // points_out × cpp_cents
  active_bonus_pct?: number      // bonus applied, if any
  is_instant: boolean
  transfer_time_max_hrs?: number
  is_best: boolean               // true for the top result
}

/** Full API response from /api/calculate */
export interface CalculateResponse {
  total_cash_value_cents: number    // sum of floor (cashback) values
  total_optimal_value_cents: number // sum of best redemption per program
  value_left_on_table_cents: number // difference = money you're leaving behind
  results: RedemptionResult[]       // all options, sorted by value DESC
}
