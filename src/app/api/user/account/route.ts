import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSessionUser } from '@/lib/auth'
import { getDb } from '@/lib/db/client'
import {
  affiliateClicks,
  alertSubscriptions,
  authUser,
  creatorConversions,
  flightWatches,
  sharedTrips,
  subscriptionEvents,
  userBalances,
  userPreferences,
  users,
} from '@/lib/db/schema'
import { getRequestId, logError, logWarn } from '@/lib/logger'

// DELETE /api/user/account — permanently deletes the signed-in user's data
// and login, in one transaction (all or nothing).
export async function DELETE(req: NextRequest) {
  const requestId = getRequestId(req)
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  try {
    await getDb().transaction(async (tx) => {
      const [profile] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.authId, user.id))
        .limit(1)

      if (profile) {
        const internalId = profile.id
        await tx.delete(flightWatches).where(eq(flightWatches.userId, internalId))
        await tx.delete(alertSubscriptions).where(eq(alertSubscriptions.userId, internalId))
        await tx.delete(userBalances).where(eq(userBalances.userId, internalId))
        await tx.delete(sharedTrips).where(eq(sharedTrips.createdBy, internalId))
        await tx.delete(userPreferences).where(eq(userPreferences.userId, internalId))
        // Keep click analytics, billing history and creator attribution, but
        // detach them from the person (these foreign keys do not cascade).
        await tx.update(affiliateClicks).set({ userId: null }).where(eq(affiliateClicks.userId, internalId))
        await tx.update(subscriptionEvents).set({ userId: null }).where(eq(subscriptionEvents.userId, internalId))
        await tx.update(creatorConversions).set({ userId: null }).where(eq(creatorConversions.userId, internalId))
        // Remaining user-owned rows (connectors, snapshots, booking guides…) cascade.
        await tx.delete(users).where(eq(users.id, internalId))
      } else {
        logWarn('account_delete_missing_profile_row', { requestId, auth_user_id: user.id })
      }

      // Removes sessions and linked Google accounts via cascade.
      await tx.delete(authUser).where(eq(authUser.id, user.id))
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logError('account_delete_failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Unable to delete account right now.' }, { status: 500 })
  }
}
