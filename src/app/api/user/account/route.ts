import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getRequestId, logError, logWarn } from '@/lib/logger'

type UserRow = {
  id: string
}

export async function DELETE(req: NextRequest) {
  const requestId = getRequestId(req)
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  const db = createAdminClient()

  try {
    const { data: userRow, error: userErr } = await db
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (userErr) {
      logError('account_delete_user_lookup_failed', {
        requestId,
        error: userErr.message,
      })
      return NextResponse.json({ error: 'Unable to delete account right now.' }, { status: 500 })
    }

    const internalUser = userRow as UserRow | null
    if (internalUser) {
      const internalId = internalUser.id

      const [prefErr, alertsErr, balancesErr, watchesErr, sharedTripsErr, clickErr] = await Promise.all([
        db.from('user_preferences').delete().eq('user_id', internalId).then((res) => res.error),
        db.from('alert_subscriptions').delete().eq('user_id', internalId).then((res) => res.error),
        db.from('user_balances').delete().eq('user_id', internalId).then((res) => res.error),
        db.from('flight_watches').delete().eq('user_id', internalId).then((res) => res.error),
        db.from('shared_trips').delete().eq('user_id', internalId).then((res) => res.error),
        db.from('affiliate_clicks').update({ user_id: null }).eq('user_id', internalId).then((res) => res.error),
      ])

      const cleanupErrors = [prefErr, alertsErr, balancesErr, watchesErr, sharedTripsErr, clickErr].filter(Boolean)
      if (cleanupErrors.length > 0) {
        logError('account_delete_cleanup_failed', {
          requestId,
          errors: cleanupErrors.map((e) => (e as { message?: string }).message ?? 'unknown'),
        })
        return NextResponse.json({ error: 'Unable to delete account right now.' }, { status: 500 })
      }

      const { error: deleteUserRowErr } = await db
        .from('users')
        .delete()
        .eq('id', internalId)

      if (deleteUserRowErr) {
        logError('account_delete_user_row_failed', {
          requestId,
          error: deleteUserRowErr.message,
        })
        return NextResponse.json({ error: 'Unable to delete account right now.' }, { status: 500 })
      }
    } else {
      logWarn('account_delete_missing_profile_row', { requestId, auth_user_id: user.id })
    }

    const { error: authDeleteErr } = await db.auth.admin.deleteUser(user.id)
    if (authDeleteErr) {
      logError('account_delete_auth_delete_failed', {
        requestId,
        error: authDeleteErr.message,
      })
      return NextResponse.json({ error: 'Unable to delete account right now.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    logError('account_delete_unhandled_error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Unable to delete account right now.' }, { status: 500 })
  }
}
