// Seats.aero `Source` → PointsMax programme slug.
// Plain ESM so scripts/check-seats-aero.mjs can share it with the provider.
// The API returns lowercase source ids ("united", "flyingblue", "virginatlantic").
// Keys here are normalized (lowercase, alphanumerics only) so casing or
// punctuation differences can never silently drop live availability again.
export const SEATS_AERO_SOURCE_TO_SLUG = {
  aeroplan: 'aeroplan',
  aircanada: 'aeroplan',
  alaska: 'alaska',
  alaskamileageplan: 'alaska',
  american: 'american',
  americanaadvantage: 'american',
  delta: 'delta',
  deltaskymiles: 'delta',
  emirates: 'emirates',
  emiratesskywards: 'emirates',
  etihad: 'etihad',
  etihadguest: 'etihad',
  flyingblue: 'flying-blue',
  jetblue: 'jetblue',
  trueblue: 'jetblue',
  singapore: 'singapore',
  krisflyer: 'singapore',
  turkish: 'turkish',
  turkishairlines: 'turkish',
  united: 'united',
  unitedmileageplus: 'united',
  virginatlantic: 'virgin-atlantic',
  // Sources Seats.aero has listed historically; harmless if absent from the API.
  british: 'british-airways',
  britishairways: 'british-airways',
  avios: 'british-airways',
  lifemiles: 'avianca',
  avianca: 'avianca',
  ana: 'ana',
  cathay: 'cathay',
  asiamiles: 'cathay',
  iberia: 'iberia',
  aerlingus: 'aer-lingus',
  hawaiian: 'hawaiian',
}

/**
 * @param {unknown} source
 * @returns {string | null}
 */
export function seatsAeroSourceToSlug(source) {
  if (typeof source !== 'string') return null
  const normalized = source.toLowerCase().replace(/[^a-z0-9]/g, '')
  return SEATS_AERO_SOURCE_TO_SLUG[normalized] ?? null
}
