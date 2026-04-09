import { NextResponse } from 'next/server'
import { getActiveBookingUrls } from '@/lib/db/booking-urls'
import { enforceRateLimit } from '@/lib/api-security'
import { logError } from '@/lib/logger'
import { isValidBookingUrl } from '@/lib/booking-urls'

export async function GET(request: Request) {
  const rateLimitResponse = await enforceRateLimit(request, {
    namespace: 'booking_urls_ip',
    maxRequests: 60,
    windowMs: 60 * 1000,
  })
  if (rateLimitResponse) return rateLimitResponse

  const { searchParams } = new URL(request.url)
  const region = searchParams.get('region') as 'us' | 'in' | null

  try {
    const urls = await getActiveBookingUrls(region)
    const validUrls = urls.filter(u => isValidBookingUrl(u.url))
    return NextResponse.json(validUrls, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    })
  } catch (error) {
    logError('api_booking_urls_get_failed', { 
      message: error instanceof Error ? error.message : 'Unknown error',
      region 
    })
    return NextResponse.json(
      { error: 'Failed to fetch booking URLs' },
      { status: 500 }
    )
  }
}
