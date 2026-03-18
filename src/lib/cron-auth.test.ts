import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { isAuthorizedCronRequest } from './cron-auth'

const originalSecret = process.env.CRON_SECRET

afterEach(() => {
  process.env.CRON_SECRET = originalSecret
})

describe('cron auth', () => {
  it('authorizes only the bearer header', () => {
    process.env.CRON_SECRET = 'cron-secret'

    const authorized = new NextRequest('https://pointsmax.com/api/cron/send-bonus-alerts', {
      headers: { authorization: 'Bearer cron-secret' },
    })
    const queryOnly = new NextRequest('https://pointsmax.com/api/cron/send-bonus-alerts?secret=cron-secret')

    expect(isAuthorizedCronRequest(authorized)).toBe(true)
    expect(isAuthorizedCronRequest(queryOnly)).toBe(false)
  })
})
