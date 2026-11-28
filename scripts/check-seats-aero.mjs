#!/usr/bin/env node
// Verify a Seats.aero API key end to end before relying on it.
//
//   SEATS_AERO_API_KEY=... npm run check:seats-aero
//   npm run check:seats-aero -- JFK LHR business 2026-11-01 2026-11-30
//
// Uses one API call (Pro keys allow 1,000/day). Reports whether the key works,
// whether results map onto PointsMax programmes, and whether we would be
// missing results to pagination.
import fs from 'node:fs'
import path from 'node:path'
import { seatsAeroSourceToSlug } from '../src/lib/award-search/seats-aero-sources.mjs'

for (const file of ['.env.local', '.env']) {
  const p = path.join(process.cwd(), file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const key = process.env.SEATS_AERO_API_KEY?.trim()
if (!key) {
  console.error('SEATS_AERO_API_KEY is not set (env or .env.local).')
  process.exit(1)
}

const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
const [origin = 'JFK', destination = 'LHR', cabin = 'business', start = inDays(30), end = inDays(60)] = process.argv.slice(2)
const cabinParam = { economy: 'economy', premium_economy: 'premium', business: 'business', first: 'first' }[cabin] ?? cabin
const cabinKey = { economy: 'Y', premium: 'W', business: 'J', first: 'F' }[cabinParam]

const url = new URL('https://seats.aero/partnerapi/search')
url.searchParams.set('origin_airport', origin)
url.searchParams.set('destination_airport', destination)
url.searchParams.set('cabin', cabinParam)
url.searchParams.set('start_date', start)
url.searchParams.set('end_date', end)

console.log(`GET ${url.pathname}?${url.searchParams} (${origin}→${destination}, ${cabin}, ${start}..${end})`)
const res = await fetch(url, { headers: { 'Partner-Authorization': key, accept: 'application/json' } })
const rateHeaders = [...res.headers.entries()].filter(([h]) => /rate|limit|quota|remaining/i.test(h))
console.log(`HTTP ${res.status}${rateHeaders.length ? `  ${rateHeaders.map(([h, v]) => `${h}=${v}`).join(' ')}` : ''}`)

if (res.status === 401 || res.status === 403) {
  console.error('\n✗ Key rejected. Check it on seats.aero → Settings → API, and that your Pro plan is active.')
  process.exit(1)
}
if (!res.ok) {
  console.error(`\n✗ Unexpected response: ${(await res.text()).slice(0, 300)}`)
  process.exit(1)
}

const json = await res.json()
const rows = Array.isArray(json) ? json : (json.data ?? [])
const sources = new Map()
let withSeats = 0
for (const row of rows) {
  const entry = sources.get(row.Source) ?? { rows: 0, available: 0, cheapest: null }
  entry.rows++
  if (cabinKey && row[`${cabinKey}Available`]) {
    withSeats++
    entry.available++
    const cost = Number.parseInt(String(row[`${cabinKey}MileageCost`] ?? '0'), 10)
    if (cost > 0 && (entry.cheapest === null || cost < entry.cheapest)) entry.cheapest = cost
  }
  sources.set(row.Source, entry)
}

console.log(`\n${rows.length} rows, ${withSeats} with ${cabin} seats.${json.hasMore ? ' hasMore=true: more pages exist that PointsMax does not fetch yet.' : ''}`)
console.log('\nSource'.padEnd(18) + 'PointsMax slug'.padEnd(18) + 'rows  with-seats  cheapest')
for (const [source, e] of [...sources.entries()].sort((a, b) => b[1].available - a[1].available)) {
  const slug = seatsAeroSourceToSlug(source)
  console.log(
    String(source).padEnd(17) + (slug ?? '— (not mapped)').padEnd(18)
    + String(e.rows).padEnd(6) + String(e.available).padEnd(12) + (e.cheapest ?? '—'),
  )
}

const mappedWithSeats = [...sources.entries()].filter(([s, e]) => e.available > 0 && seatsAeroSourceToSlug(s)).length
if (rows.length === 0) {
  console.log('\n? Key works but this route/date range returned nothing. Try a busier route, e.g. JFK LHR business.')
} else if (mappedWithSeats === 0) {
  console.log('\n✗ Results came back but none map to PointsMax programmes — the source mapping needs updating.')
  process.exit(1)
} else {
  console.log(`\n✓ Live availability works: ${mappedWithSeats} programme(s) with seats map onto PointsMax.`)
}
