// ============================================================
// GET /api/alerts/unsubscribe?token=<base64url(email)>
// Deactivates alert subscription via one-click unsubscribe
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyUnsubscribeToken } from '@/lib/alerts-token'

function getSafeAppUrl(): string {
  const fallback = 'https://pointsmax.com'
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? fallback
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fallback
    return parsed.origin
  } catch {
    return fallback
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return new NextResponse('Missing token', { status: 400 })
  }

  const email = verifyUnsubscribeToken(token)
  if (!email) {
    return new NextResponse('Invalid token', { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db
    .from('alert_subscriptions')
    .update({ is_active: false })
    .eq('email', email)

  if (error) {
    return new NextResponse('Failed to unsubscribe. Please try again.', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const appUrl = getSafeAppUrl()

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unsubscribed — PointsMax</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; }
    .card { background: white; border-radius: 16px; padding: 40px; max-width: 400px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    h1 { font-size: 1.25rem; color: #0f172a; margin: 0 0 8px; }
    p { color: #64748b; font-size: 0.875rem; }
    a { color: #4f46e5; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You've been unsubscribed</h1>
    <p>You'll no longer receive transfer bonus alerts from PointsMax.</p>
    <p style="margin-top:16px"><a href="${appUrl}">← Back to PointsMax</a></p>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } },
  )
}
