import { NextResponse } from 'next/server'
import { getActiveBookingUrls } from '@/lib/db/booking-urls'
import { logError } from '@/lib/logger'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const region = searchParams.get('region') as 'us' | 'in' | null

  try {
    const urls = await getActiveBookingUrls(region)
    return NextResponse.json(urls)
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
