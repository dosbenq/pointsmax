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
  '/inspire',
  '/us/inspire',
  '/in/inspire',
  '/card-recommender',
  '/us/card-recommender',
  '/earning-calculator',
  '/trip-builder',
  '/us/trip-builder',
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
]

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
      const requiredCtas = ['/us/calculator', '/us/trip-builder', '/us/card-recommender', '/us/profile', '/us/inspire']
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
    if (route === '/trip-builder' || route === '/us/trip-builder') {
      if (!text.includes('Build the booking path, not just the trip idea.')) {
        throw new Error(`${route} did not render trip-builder launch messaging`)
      }
    }
    if (route === '/profile' || route === '/us/profile' || route === '/in/profile') {
      if (!text.includes('Wallet')) {
        throw new Error(`${route} did not render Wallet content`)
      }
    }
    if (route === '/inspire' && !res.url.endsWith('/us/inspire')) {
      throw new Error(`/inspire should resolve to /us/inspire, got ${res.url}`)
    }
    if ((route === '/us/inspire' || route === '/in/inspire') && !text.includes('Award sweet spots worth chasing')) {
      throw new Error(`${route} did not render inspiration content`)
    }
    if ((route === '/us/cards' || route === '/in/cards') && !text.includes('Turn card research into a booking decision')) {
      throw new Error(`${route} did not render card strategy directory content`)
    }
    if ((route === '/us/programs' || route === '/in/programs') && !text.includes('Programs are only useful when they lead to bookings')) {
      throw new Error(`${route} did not render program directory content`)
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
  })

  startProc.stdout.on('data', (chunk) => process.stdout.write(chunk))
  startProc.stderr.on('data', (chunk) => process.stderr.write(chunk))

  try {
    await waitForServer()
    await verifyRoutes()
    console.log(`Smoke checks passed against ${BASE_URL}`)
  } finally {
    startProc.kill('SIGTERM')
    await new Promise((resolve) => setTimeout(resolve, 500))
    if (!startProc.killed) startProc.kill('SIGKILL')
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
