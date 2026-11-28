#!/usr/bin/env node

const BASE_URL = (process.env.BASE_URL ?? '').trim().replace(/\/+$/, '')
const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim()
const PROGRAM_ID = process.env.PROGRAM_ID ?? '11111111-0001-0001-0001-000000000001'
const TEST_EMAIL = process.env.TEST_EMAIL ?? 'watchdog@example.com'

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
  const cronHeaders = { authorization: `Bearer ${CRON_SECRET}` }

  await requestJson('Health', `${BASE_URL}/api/health`)


  await requestJson('Transfer options', `${BASE_URL}/api/transfer-options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      region: 'US',
      balances: [{ program_id: PROGRAM_ID, amount: 120000 }],
      trip: { origin: 'JFK', destination: 'LHR', date: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10), cabin: 'business', passengers: 1 },
    }),
  }, {
    validate: ({ json }) => Boolean(json && Array.isArray(json.options) && json.options.length > 0),
  })

  await requestJson('Alerts subscribe', `${BASE_URL}/api/alerts/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      program_ids: [PROGRAM_ID],
    }),
  })

  await requestJson('Cron send bonus alerts', `${BASE_URL}/api/cron/send-bonus-alerts`, { headers: cronHeaders })

  console.log('Automation watchdog checks completed successfully.')
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
