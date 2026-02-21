import { NextRequest, NextResponse } from 'next/server'
import { calculateRedemptions } from '@/lib/calculate'
import type { BalanceInput } from '@/types/database'

// POST /api/calculate
// Body: { balances: [{ program_id: string, amount: number }] }
// Returns: ranked redemption options with dollar values
export async function POST(req: NextRequest) {
  let body: { balances: BalanceInput[] }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { balances } = body

  if (!Array.isArray(balances) || balances.length === 0) {
    return NextResponse.json({ error: 'Provide at least one balance' }, { status: 400 })
  }

  // Validate each balance entry
  for (const b of balances) {
    if (!b.program_id || typeof b.amount !== 'number' || b.amount <= 0) {
      return NextResponse.json(
        { error: 'Each balance needs a program_id and a positive amount' },
        { status: 400 }
      )
    }
  }

  try {
    const result = await calculateRedemptions(balances)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Calculation error:', err)
    return NextResponse.json({ error: 'Calculation failed' }, { status: 500 })
  }
}
