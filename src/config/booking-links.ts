export type BookingLinkCategory = 'hotel_portal' | 'transfer_portal' | 'flight_booking_portal'

export type BookingLink = {
  id: string
  label: string
  url: string
  category: BookingLinkCategory
}

const BOOKING_LINKS: BookingLink[] = [
  { id: 'hyatt', label: 'World of Hyatt', url: 'https://world.hyatt.com/content/gp/en/rewards/free-nights-upgrades.html', category: 'hotel_portal' },
  { id: 'marriott', label: 'Marriott Bonvoy', url: 'https://www.marriott.com/loyalty/redeem.mi', category: 'hotel_portal' },
  { id: 'hilton', label: 'Hilton Honors', url: 'https://www.hilton.com/en/hilton-honors/points/', category: 'hotel_portal' },
  { id: 'ihg', label: 'IHG One Rewards', url: 'https://www.ihg.com/onerewards/content/us/en/redeem-rewards', category: 'hotel_portal' },
  { id: 'wyndham', label: 'Wyndham Rewards', url: 'https://www.wyndhamhotels.com/wyndham-rewards/redeem', category: 'hotel_portal' },
  { id: 'choice', label: 'Choice Privileges', url: 'https://www.choicehotels.com/choice-privileges', category: 'hotel_portal' },

  { id: 'chase-transfer', label: 'Chase UR transfer', url: 'https://www.ultimaterewards.com', category: 'transfer_portal' },
  { id: 'amex-transfer', label: 'Amex MR transfer', url: 'https://global.americanexpress.com/rewards/transfer', category: 'transfer_portal' },
  { id: 'capitalone-transfer', label: 'Capital One transfer', url: 'https://www.capitalone.com/learn-grow/money-management/venture-miles-transfer-partnerships/', category: 'transfer_portal' },
  { id: 'citi-transfer', label: 'Citi ThankYou transfer', url: 'https://www.citi.com/credit-cards/thankyou-rewards', category: 'transfer_portal' },
  { id: 'bilt-transfer', label: 'Bilt transfer', url: 'https://www.bilt.com/rewards/travel', category: 'transfer_portal' },

  { id: 'united-booking', label: 'United award booking', url: 'https://www.united.com/en/us/fly/travel/awards.html', category: 'flight_booking_portal' },
  { id: 'delta-booking', label: 'Delta award booking', url: 'https://www.delta.com/us/en/skymiles/overview', category: 'flight_booking_portal' },
  { id: 'aa-booking', label: 'American AAdvantage booking', url: 'https://www.aa.com/homePage.do', category: 'flight_booking_portal' },
  { id: 'aeroplan-booking', label: 'Air Canada Aeroplan booking', url: 'https://www.aircanada.com/ca/en/aco/home/aeroplan.html', category: 'flight_booking_portal' },
  { id: 'ba-booking', label: 'British Airways Avios booking', url: 'https://www.britishairways.com/travel/home/public/en_us/', category: 'flight_booking_portal' },
  { id: 'flyingblue-booking', label: 'Flying Blue booking', url: 'https://www.flyingblue.com/en/spend/flights', category: 'flight_booking_portal' },
  { id: 'krisflyer-booking', label: 'Singapore KrisFlyer booking', url: 'https://www.singaporeair.com/en_UK/us/home', category: 'flight_booking_portal' },
  { id: 'turkish-booking', label: 'Turkish Miles&Smiles booking', url: 'https://www.turkishairlines.com/en-int/miles-and-smiles/', category: 'flight_booking_portal' },
  { id: 'lifemiles-booking', label: 'Avianca LifeMiles booking', url: 'https://www.lifemiles.com/fly/search', category: 'flight_booking_portal' },
]

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function getBookingLinks(category?: BookingLinkCategory): BookingLink[] {
  const links = category ? BOOKING_LINKS.filter((link) => link.category === category) : BOOKING_LINKS
  return links.filter((link) => isValidHttpUrl(link.url))
}

export function formatBookingLinksForPrompt(category: BookingLinkCategory): string {
  return getBookingLinks(category)
    .map((link) => `- ${link.label}: ${link.url}`)
    .join('\n')
}

export function getTripBuilderPromptSections() {
  return {
    hotelBookingUrls: [
      'Known hotel award booking portals (use ONLY these exact URLs for hotel.booking_url):',
      formatBookingLinksForPrompt('hotel_portal'),
    ].join('\n'),
    bookingStepUrls: [
      'Known portal URLs (use ONLY these for booking_steps urls, or null if no exact match):',
      formatBookingLinksForPrompt('transfer_portal'),
      formatBookingLinksForPrompt('flight_booking_portal'),
    ].join('\n'),
  }
}
