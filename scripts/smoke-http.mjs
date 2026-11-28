#!/usr/bin/env node
import { spawn } from 'node:child_process'

const PORT = Number(process.env.SMOKE_PORT ?? 4010)
const BASE_URL = `http://127.0.0.1:${PORT}`
const START_TIMEOUT_MS = 90_000

const ROUTES = [
  '/',
  '/us',
  '/calculator',
  '/us/calculator',
  '/award-search',
  '/us/award-search',
  '/card-recommender',
  '/us/card-recommender',
  '/earning-calculator',
  '/us/cards',
  '/in/cards',
  '/us/programs',
  '/in/programs',
  '/pricing',
  '/how-it-works',
  '/profile',
  '/us/profile',
  '/in/profile',
  '/robots.txt',
  '/sitemap.xml',
  '/us/cards/best/best-travel-cards-us',
  '/api/valuations',
]

// Reference data ships with the build, so these must show real content even
// though CI points the app at an unreachable database.
const REQUIRED_CONTENT = {
  '/us/programs': ['Chase Ultimate Rewards'],
  '/in/programs': ['HDFC'],
  '/us/cards': ['Chase Sapphire Preferred'],
  '/in/cards': ['HDFC Infinia'],
  '/us/cards/best/best-travel-cards-us': ['Best Travel Cards in the US'],
  '/api/valuations': ['chase-ur'],
  '/sitemap.xml': ['/us/programs/chase-ur'],
}

function isoDate(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10)
}

async function postJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (res.status !== 200) throw new Error(`Expected 200 for POST ${path}, got ${res.status}: ${JSON.stringify(json)}`)
  return json
}

async function verifyCatalogApis() {
  const programs = await (await fetch(`${BASE_URL}/api/programs?region=US`)).json()
  const chase = (programs.programs ?? programs).find?.((p) => p.slug === 'chase-ur')
  if (!chase) throw new Error('/api/programs did not include chase-ur')

  const calc = await postJson('/api/calculate', { balances: [{ program_id: chase.id, amount: 100000 }] })
  if (!Array.isArray(calc.results) || calc.results.length === 0 || !(calc.total_optimal_value_cents > 0)) {
    throw new Error(`/api/calculate returned no results: ${JSON.stringify(calc).slice(0, 200)}`)
  }

  const hotels = await postJson('/api/hotel-search', {
    destination_region: 'europe',
    check_in: isoDate(30),
    check_out: isoDate(32),
    balances: [{ program_id: chase.id, amount: 100000 }],
  })
  const hotelResults = hotels.results ?? []
  if (!hotelResults.some((row) => row.program_slug === 'hyatt')) {
    throw new Error(`/api/hotel-search returned no Hyatt tiers: ${JSON.stringify(hotels).slice(0, 200)}`)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer() {
  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/`, { redirect: 'manual' })
      if (res.status >= 200 && res.status < 500) return
    } catch {
      // Keep polling until timeout.
    }
    await sleep(1000)
  }
  throw new Error(`Server did not become ready within ${START_TIMEOUT_MS}ms`)
}

async function verifyRoutes() {
  for (const route of ROUTES) {
    const res = await fetch(`${BASE_URL}${route}`, { redirect: 'follow' })
    if (res.status !== 200) {
      throw new Error(`Expected 200 for ${route}, got ${res.status}`)
    }
    const text = await res.text()
    if (route === '/') {
      if (!text.includes('PointsMax')) {
        throw new Error('Homepage did not include expected "PointsMax" marker')
      }
    }
    if (route === '/us') {
      const requiredCtas = ['/us/calculator', '/us/card-recommender', '/us/profile', '/us/award-search']
      for (const href of requiredCtas) {
        if (!text.includes(`href="${href}"`)) {
          throw new Error(`/us homepage did not include expected CTA link ${href}`)
        }
      }
    }
    if (route === '/us/calculator' && !text.includes('Planner')) {
      throw new Error('/us/calculator did not render Planner content')
    }
    if (route === '/award-search' || route === '/us/award-search') {
      if (!text.includes('See what your points can actually book on this route.')) {
        throw new Error(`${route} did not render award-search launch messaging`)
      }
    }
    if (route === '/us/card-recommender' && !text.includes('best credit card strategy')) {
      throw new Error('/us/card-recommender did not render card recommender content')
    }
    if (route === '/profile' || route === '/us/profile' || route === '/in/profile') {
      if (!text.includes('Wallet')) {
        throw new Error(`${route} did not render Wallet content`)
      }
    }
    if ((route === '/us/cards' || route === '/in/cards') && !text.includes('Turn card research into a booking decision')) {
      throw new Error(`${route} did not render card strategy directory content`)
    }
    if ((route === '/us/programs' || route === '/in/programs') && !text.includes('Programs are only useful when they lead to bookings')) {
      throw new Error(`${route} did not render program directory content`)
    }
    for (const marker of REQUIRED_CONTENT[route] ?? []) {
      if (!text.includes(marker)) {
        throw new Error(`${route} did not include expected content "${marker}"`)
      }
    }
    if (route === '/us/cards/best/best-travel-cards-us' && text.includes('Comparison not found')) {
      throw new Error('/us/cards/best/best-travel-cards-us rendered "Comparison not found"')
    }
    if (route === '/earning-calculator' && !res.url.includes('/card-recommender?view=earnings')) {
      throw new Error(`/earning-calculator should resolve to card-recommender earnings view, got ${res.url}`)
    }
  }
}

async function main() {
  const startProc = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'start', '--', '-p', String(PORT)], {
    env: {
      ...process.env,
      PORT: String(PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group, so stopping it also stops the `next start` child npm spawns.
    detached: process.platform !== 'win32',
  })

  startProc.stdout.on('data', (chunk) => process.stdout.write(chunk))
  startProc.stderr.on('data', (chunk) => process.stderr.write(chunk))

  try {
    await waitForServer()
    await verifyRoutes()
    await verifyCatalogApis()
    console.log(`Smoke checks passed against ${BASE_URL}`)
  } finally {
    await stopServer(startProc)
  }
}

async function stopServer(proc) {
  const signal = (name) => {
    try {
      if (process.platform === 'win32') proc.kill(name)
      else process.kill(-proc.pid, name)
    } catch {
      // already exited
    }
  }
  signal('SIGTERM')
  await sleep(1000)
  signal('SIGKILL')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
