import { NextRequest, NextResponse } from 'next/server'
import { buildDeepLink } from '@/lib/award-search/deep-links'
import type { CabinClass } from '@/lib/award-search/types'
import { enforceJsonContentLength, enforceRateLimit } from '@/lib/api-security'
import { badRequest } from '@/lib/error-utils'
import { getActiveTransferBonuses } from '@/lib/transfer-bonuses'
import { buildTransferOptions, type WalletBalance } from '@/lib/transfer-options'

const MAX_BODY_BYTES = 8_000
const IATA = /^[A-Z]{3}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const CABINS: CabinClass[] = ['economy', 'premium_economy', 'business', 'first']

type Body = {
  region?: unknown
  balances?: unknown
  trip?: { origin?: unknown; destination?: unknown; date?: unknown; cabin?: unknown; passengers?: unknown }
}

function parseBalances(raw: unknown): WalletBalance[] | null {
  if (!Array.isArray(raw) || raw.length > 20) return null
  const balances: WalletBalance[] = []
  for (const entry of raw) {
    const row = entry as { program_id?: unknown; amount?: unknown }
    const amount = Number(row?.amount)
    if (typeof row?.program_id !== 'string' || !Number.isFinite(amount) || amount < 0 || amount > 100_000_000) return null
    balances.push({ program_id: row.program_id, amount })
  }
  return balances
}

// POST /api/transfer-options
// Body: { region: 'US'|'IN', balances: [{ program_id, amount }], trip?: { origin, destination, date, cabin, passengers } }
// Returns, for each airline program the wallet can reach, the exact
// conversion (ratio + verified bonus) and a link to that airline's own award
// search. Seat availability is not checked: nothing here is an estimate.
export async function POST(req: NextRequest) {
  const sizeError = enforceJsonContentLength(req, MAX_BODY_BYTES)
  if (sizeError) return sizeError
  const limited = await enforceRateLimit(req, { namespace: 'transfer_options', windowMs: 60_000, maxRequests: 60 })
  if (limited) return limited

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return badRequest('Invalid JSON')
  }

  const region = body.region === 'IN' ? 'IN' : 'US'
  const balances = parseBalances(body.balances)
  if (!balances) return badRequest('balances must be a list of { program_id, amount }')

  const origin = String(body.trip?.origin ?? '').trim().toUpperCase()
  const destination = String(body.trip?.destination ?? '').trim().toUpperCase()
  const date = String(body.trip?.date ?? '')
  const cabin = CABINS.includes(body.trip?.cabin as CabinClass) ? (body.trip?.cabin as CabinClass) : 'economy'
  const passengers = Math.min(9, Math.max(1, Math.floor(Number(body.trip?.passengers) || 1)))
  const hasTrip = IATA.test(origin) && IATA.test(destination) && DATE.test(date)

  const bonuses = await getActiveTransferBonuses()
  const options = buildTransferOptions(balances, region, bonuses).map((option) => ({
    ...option,
    airline_search: hasTrip
      ? buildDeepLink(option.program_slug, { origin, destination, cabin, passengers, start_date: date, end_date: date, balances: [] })
      : null,
  }))

  return NextResponse.json(
    { region, options, seats: 'not_checked' as const },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
