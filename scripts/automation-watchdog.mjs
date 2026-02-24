#!/usr/bin/env node

const BASE_URL = (process.env.BASE_URL ?? '').trim().replace(/\/+$/, '')
const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim()
const PROGRAM_ID = process.env.PROGRAM_ID ?? '11111111-0001-0001-0001-000000000001'
const CARD_ID = process.env.CARD_ID ?? 'aaaa0001-0000-0000-0000-000000000001'
const TEST_EMAIL = process.env.TEST_EMAIL ?? 'watchdog@example.com'
const MAX_CALC_LATENCY_MS = Number.parseInt(process.env.MAX_CALCULATE_LATENCY_MS ?? '2500', 10)
const CHECK_EXPERT_CHAT = ['1', 'true', 'yes'].includes((process.env.CHECK_EXPERT_CHAT ?? '').toLowerCase())

if (!BASE_URL) {
  console.error('Set BASE_URL, e.g. BASE_URL=https://pointsmax.com')
  process.exit(1)
}
if (!CRON_SECRET) {
  console.error('Set CRON_SECRET for cron endpoint checks')
  process.exit(1)
}

function nowMs() {
  return Date.now()
}

function trimBody(body, max = 350) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return text.length > max ? `${text.slice(0, max)}…` : text
}

async function requestJson(label, url, init = {}, options = {}) {
  const start = nowMs()
  const response = await fetch(url, init)
  const duration = nowMs() - start
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // keep text
  }

  const okStatus = response.status >= 200 && response.status < 300
  const ok = okStatus && (typeof options.validate === 'function' ? options.validate({ response, json, text }) : true)

  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} [${response.status}] ${duration}ms ${url}`)
  console.log(`  ${trimBody(json ?? text)}`)

  if (!ok) {
    const reason = okStatus ? 'validation_failed' : `status_${response.status}`
    throw new Error(`${label} failed (${reason})`)
  }

  return { response, json, text, duration }
}

async function run() {
  await requestJson('Health', `${BASE_URL}/api/health`)

  await requestJson('Cards US', `${BASE_URL}/api/cards?geography=US`)
  await requestJson('Cards IN', `${BASE_URL}/api/cards?geography=IN`)

  await requestJson('Calculate', `${BASE_URL}/api/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      balances: [{ program_id: PROGRAM_ID, amount: 100000 }],
    }),
  }, {
    validate: ({ response, json }) => {
      const latencyRaw = response.headers.get('X-Calculate-Latency-Ms')
      const latency = latencyRaw ? Number.parseInt(latencyRaw, 10) : NaN
      if (Number.isFinite(latency) && latency > MAX_CALC_LATENCY_MS) {
        console.error(`  Calculate latency too high: ${latency}ms (max ${MAX_CALC_LATENCY_MS}ms)`)
        return false
      }
      return Boolean(json && typeof json === 'object' && Array.isArray(json.results))
    },
  })

  await requestJson('Award search', `${BASE_URL}/api/award-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: 'JFK',
      destination: 'LHR',
      cabin: 'business',
      passengers: 1,
      start_date: '2026-06-01',
      end_date: '2026-06-07',
      balances: [{ program_id: PROGRAM_ID, amount: 120000 }],
      include_narrative: false,
    }),
  }, {
    validate: ({ json }) => Boolean(json && typeof json === 'object' && Array.isArray(json.results)),
  })

  await requestJson('AI recommend', `${BASE_URL}/api/ai/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      history: [],
      message: 'Best way to use points for Tokyo in business class?',
      balances: [{ name: 'Chase Ultimate Rewards', amount: 120000 }],
    }),
  })

  if (CHECK_EXPERT_CHAT) {
    await requestJson('AI expert-chat', `${BASE_URL}/api/ai/expert-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Which India travel card under 5000 fee is best?' }),
    })
  }

  await requestJson('Affiliate click tracking', `${BASE_URL}/api/analytics/affiliate-click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card_id: CARD_ID,
      program_id: PROGRAM_ID,
      source_page: 'automation-watchdog',
    }),
  })

  await requestJson('Alerts subscribe', `${BASE_URL}/api/alerts/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      program_ids: [PROGRAM_ID],
    }),
  })

  const cronSecret = encodeURIComponent(CRON_SECRET)
  await requestJson('Cron update valuations', `${BASE_URL}/api/cron/update-valuations?secret=${cronSecret}`)
  await requestJson('Cron send bonus alerts', `${BASE_URL}/api/cron/send-bonus-alerts?secret=${cronSecret}`)
  await requestJson('Cron ingest knowledge', `${BASE_URL}/api/cron/ingest-youtube-knowledge?secret=${cronSecret}`)

  console.log('Automation watchdog checks completed successfully.')
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
