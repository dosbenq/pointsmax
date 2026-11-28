#!/usr/bin/env node
import { spawn } from 'node:child_process'

const PORT = Number(process.env.SMOKE_PORT ?? 4010)
const BASE_URL = `http://127.0.0.1:${PORT}`
const START_TIMEOUT_MS = 90_000

const ROUTES = [
  '/',
  '/us',
  '/in',
  '/profile',
  '/us/profile',
  '/in/profile',
  '/robots.txt',
  '/sitemap.xml',
  '/api/valuations',
]

// Reference data ships with the build, so these must show real content even
// though CI points the app at an unreachable database.
const REQUIRED_CONTENT = {
  '/us': ['What can your points book?'],
  '/in': ['What can your points book?'],
  '/api/valuations': ['chase-ur'],
  '/sitemap.xml': ['/in/terms'],
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

  const options = await postJson('/api/transfer-options', {
    region: 'US',
    balances: [{ program_id: chase.id, amount: 100000 }],
    trip: { origin: 'JFK', destination: 'LHR', date: isoDate(60), cabin: 'business', passengers: 1 },
  })
  const united = (options.options ?? []).find((o) => o.program_slug === 'united')
  if (!united || united.miles_available !== 100000 || !united.airline_search?.url) {
    throw new Error(`/api/transfer-options did not convert Chase points to United: ${JSON.stringify(options).slice(0, 200)}`)
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
    if (route === '/profile' || route === '/us/profile' || route === '/in/profile') {
      if (!text.includes('Wallet')) {
        throw new Error(`${route} did not render Wallet content`)
      }
    }
    for (const marker of REQUIRED_CONTENT[route] ?? []) {
      if (!text.includes(marker)) {
        throw new Error(`${route} did not include expected content "${marker}"`)
      }
    }
  }
}

// Removed pages must redirect permanently (old links and search results),
// and unknown pages must be real 404s.
const REDIRECTS = {
  '/us/cards': '/us',
  '/us/cards/chase-sapphire-preferred-chase': '/us',
  '/in/programs/hdfc-millennia': '/in',
  '/us/card-recommender': '/us',
  '/in/earning-calculator': '/in',
  '/card-recommender': '/',
  '/us/hotel-search': '/us',
  '/in/how-it-works': '/in',
  '/how-it-works': '/',
  '/calculator': '/',
  '/us/calculator': '/us',
  '/in/award-search': '/in',
  '/us/onboarding': '/us',
}
// Paused pages redirect temporarily (they will come back).
const PAUSED = { '/us/pricing': '/us' }
const MUST_404 = ['/us/not-a-real-page']

async function verifyRedirectsAndNotFound() {
  for (const [route, target] of Object.entries(REDIRECTS)) {
    const res = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' })
    const location = res.headers.get('location') ?? ''
    if (res.status !== 308 || new URL(location, BASE_URL).pathname !== target) {
      throw new Error(`Expected ${route} to redirect permanently to ${target}, got ${res.status} ${location}`)
    }
  }
  for (const [route, target] of Object.entries(PAUSED)) {
    const res = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' })
    const location = res.headers.get('location') ?? ''
    if (res.status !== 307 || new URL(location, BASE_URL).pathname !== target) {
      throw new Error(`Expected ${route} to redirect temporarily to ${target}, got ${res.status} ${location}`)
    }
  }
  for (const route of MUST_404) {
    const res = await fetch(`${BASE_URL}${route}`, { redirect: 'follow' })
    if (res.status !== 404) throw new Error(`Expected 404 for ${route}, got ${res.status}`)
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
    await verifyRedirectsAndNotFound()
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
