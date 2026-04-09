import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  const db = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [usersRes, programsRes, bonusesRes, recentRes] = await Promise.all([
    db.from('users').select('*', { count: 'exact', head: true }),
    db.from('programs').select('*', { count: 'exact', head: true }).eq('is_active', true),
    db.from('transfer_bonuses')
      .select('*', { count: 'exact', head: true })
      .lte('start_date', today)
      .gte('end_date', today),
    db.from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),
  ])

  return NextResponse.json({
    total_users: usersRes.count ?? 0,
    active_programs: programsRes.count ?? 0,
    active_bonuses: bonusesRes.count ?? 0,
    recent_signups: recentRes.count ?? 0,
  })
}
