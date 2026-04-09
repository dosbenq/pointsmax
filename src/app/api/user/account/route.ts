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

      // Use sequential deletion with error tracking
      const deletionSteps = [
        { table: 'flight_watches', filter: { user_id: internalId } },
        { table: 'alert_subscriptions', filter: { user_id: internalId } },
        { table: 'user_balances', filter: { user_id: internalId } },
        { table: 'shared_trips', filter: { created_by: internalId } },
        { table: 'user_preferences', filter: { user_id: internalId } },
      ] as const

      const errors: string[] = []
      for (const step of deletionSteps) {
        const filterKey = Object.keys(step.filter)[0]
        const filterVal = Object.values(step.filter)[0]
        const { error } = await db
          .from(step.table)
          .delete()
          .eq(filterKey, filterVal)
        if (error) {
          errors.push(`${step.table}: ${error.message}`)
        }
      }

      // Nullify affiliate clicks rather than delete
      const { error: clickErr } = await db
        .from('affiliate_clicks')
        .update({ user_id: null })
        .eq('user_id', internalId)
      if (clickErr) {
        errors.push(`affiliate_clicks: ${clickErr.message}`)
      }

      if (errors.length > 0) {
        logError('account_deletion_partial_failure', { requestId, userId: internalId, errors })
        // Don't proceed with auth deletion if data cleanup had failures
        return NextResponse.json(
          { error: 'Account deletion partially failed. Please contact support.' },
          { status: 500 }
        )
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

    // Only delete auth user if all data cleanup succeeded
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
