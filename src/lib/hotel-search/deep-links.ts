const HOTEL_BOOKING_URLS: Record<string, string> = {
  hyatt: 'https://world.hyatt.com/content/gp/en/rewards.html',
  marriott: 'https://www.marriott.com/loyalty/redeem.mi',
  hilton: 'https://www.hilton.com/en/hilton-honors/points/',
}

export function getHotelBookingUrl(programSlug: string, preferredUrl?: string | null): string | null {
  if (preferredUrl?.startsWith('https://')) return preferredUrl
  return HOTEL_BOOKING_URLS[programSlug] ?? null
}
