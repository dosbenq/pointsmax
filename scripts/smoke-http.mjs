#!/usr/bin/env node
import { spawn } from 'node:child_process'

const PORT = Number(process.env.SMOKE_PORT ?? 4010)
const BASE_URL = `http://127.0.0.1:${PORT}`
const START_TIMEOUT_MS = 90_000

const ROUTES = [
  '/',
  '/calculator',
  '/award-search',
  '/inspire',
  '/card-recommender',
  '/earning-calculator',
  '/trip-builder',
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
    if (route === '/profile' || route === '/us/profile' || route === '/in/profile') {
      if (!text.includes('Wallet')) {
        throw new Error(`${route} did not render Wallet content`)
      }
    }
    if (route === '/inspire' && !res.url.endsWith('/calculator')) {
      throw new Error(`/inspire should resolve to calculator, got ${res.url}`)
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
