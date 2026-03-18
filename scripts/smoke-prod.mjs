#!/usr/bin/env node

const BASE_URL = (process.env.BASE_URL ?? '').replace(/\/+$/, '')
const CRON_SECRET = process.env.CRON_SECRET ?? ''
const TEST_EMAIL = process.env.TEST_EMAIL ?? 'launch-smoke@example.com'

const CARD_ID = process.env.CARD_ID ?? 'aaaa0001-0000-0000-0000-000000000001'
const PROGRAM_ID = process.env.PROGRAM_ID ?? '11111111-0001-0001-0001-000000000001'

if (!BASE_URL) {
  console.error('Set BASE_URL, e.g. BASE_URL=https://pointsmax.com')
  process.exit(1)
}
if (!CRON_SECRET) {
  console.error('Set CRON_SECRET for cron endpoint checks')
  process.exit(1)
}

function trunc(text, max = 350) {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

async function requestJson(label, url, init = {}) {
  const response = await fetch(url, init)
  const bodyText = await response.text()
  let parsed = null
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    // non-JSON response is still reported below
  }

  const ok = response.status >= 200 && response.status < 300
  const details = parsed ? JSON.stringify(parsed) : bodyText
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} [${response.status}] ${url}`)
  console.log(`  ${trunc(details)}`)
  if (!ok) {
    throw new Error(`${label} failed with status ${response.status}`)
  }
}

async function run() {
  const cronHeaders = { authorization: `Bearer ${CRON_SECRET}` }

  await requestJson('Health', `${BASE_URL}/api/health`)
  await requestJson('Cards US', `${BASE_URL}/api/cards?geography=US`)
  await requestJson('Cards IN', `${BASE_URL}/api/cards?geography=IN`)

  await requestJson('Award search', `${BASE_URL}/api/award-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: 'JFK',
      destination: 'NRT',
      cabin: 'business',
      passengers: 1,
      start_date: '2026-06-01',
      end_date: '2026-06-07',
      balances: [{ program_id: PROGRAM_ID, amount: 120000 }],
    }),
  })

  await requestJson('AI recommend (balances-only)', `${BASE_URL}/api/ai/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      history: [],
      message: 'I want to fly business class to Tokyo.',
      balances: [{ name: 'Chase Ultimate Rewards', amount: 120000 }],
    }),
  })

  await requestJson('Affiliate click tracking', `${BASE_URL}/api/analytics/affiliate-click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card_id: CARD_ID,
      program_id: PROGRAM_ID,
      source_page: 'smoke-prod-script',
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

  await requestJson('Cron update valuations', `${BASE_URL}/api/cron/update-valuations`, { headers: cronHeaders })
  await requestJson('Cron send bonus alerts', `${BASE_URL}/api/cron/send-bonus-alerts`, { headers: cronHeaders })

  console.log('Production smoke checks completed successfully.')
}

run().catch((err) => {
  console.error(err.message || String(err))
  process.exit(1)
})
