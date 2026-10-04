import { NextResponse } from 'next/server'
import { and, eq, gte, lte } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { programs, transferBonuses, users } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const db = getDb()
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [totalUsers, activePrograms, activeBonuses, recentSignups] = await Promise.all([
    db.$count(users),
    db.$count(programs, eq(programs.isActive, true)),
    db.$count(transferBonuses, and(lte(transferBonuses.startDate, today), gte(transferBonuses.endDate, today))),
    db.$count(users, gte(users.createdAt, sevenDaysAgo)),
  ])

  return NextResponse.json({
    total_users: totalUsers,
    active_programs: activePrograms,
    active_bonuses: activeBonuses,
    recent_signups: recentSignups,
  })
}
