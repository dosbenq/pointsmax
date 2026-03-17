import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyDigestUnsubscribeToken } from '@/lib/digest-email-token'
import { getConfiguredAppOrigin } from '@/lib/app-origin'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? ''
  const userId = verifyDigestUnsubscribeToken(token)
  const appOrigin = getConfiguredAppOrigin()

  if (!userId) {
    return NextResponse.redirect(`${appOrigin}/pricing?digest_unsubscribe=invalid`)
  }

  const db = createAdminClient()
  await db
    .from('user_preferences')
    .upsert({ user_id: userId, digest_email_enabled: false }, { onConflict: 'user_id' })

  return NextResponse.redirect(`${appOrigin}/pricing?digest_unsubscribe=ok`)
}
