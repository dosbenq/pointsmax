import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { userPreferences } from '@/lib/db/schema'
import { verifyDigestUnsubscribeToken } from '@/lib/digest-email-token'
import { getConfiguredAppOrigin } from '@/lib/app-origin'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? ''
  const userId = verifyDigestUnsubscribeToken(token)
  const appOrigin = getConfiguredAppOrigin()

  if (!userId) {
    return NextResponse.redirect(`${appOrigin}/pricing?digest_unsubscribe=invalid`)
  }

  try {
    await getDb()
      .insert(userPreferences)
      .values({ userId, digestEmailEnabled: false })
      .onConflictDoUpdate({ target: userPreferences.userId, set: { digestEmailEnabled: false } })
  } catch {
    return NextResponse.redirect(`${appOrigin}/pricing?digest_unsubscribe=invalid`)
  }

  return NextResponse.redirect(`${appOrigin}/pricing?digest_unsubscribe=ok`)
}
