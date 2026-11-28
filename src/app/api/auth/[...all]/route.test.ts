// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { GET, POST } from './route'

const saved = { DATABASE_URL: process.env.DATABASE_URL, POSTGRES_URL: process.env.POSTGRES_URL }

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('/api/auth/*', () => {
  it('answers 503 instead of crashing when no database is configured', async () => {
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL

    const get = await GET(new Request('https://pointsmax.com/api/auth/get-session'))
    const post = await POST(new Request('https://pointsmax.com/api/auth/sign-in/social', { method: 'POST', body: '{}' }))

    expect(get.status).toBe(503)
    expect(post.status).toBe(503)
  })
})
