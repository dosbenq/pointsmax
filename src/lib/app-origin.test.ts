import { afterEach, describe, expect, it } from 'vitest'
import { getConfiguredAppOrigin, getSafeAppOrigin } from '@/lib/app-origin'

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL
const ORIGINAL_VERCEL_URL = process.env.VERCEL_URL
const ORIGINAL_PORT = process.env.PORT

afterEach(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL

  if (ORIGINAL_VERCEL_URL === undefined) delete process.env.VERCEL_URL
  else process.env.VERCEL_URL = ORIGINAL_VERCEL_URL

  if (ORIGINAL_PORT === undefined) delete process.env.PORT
  else process.env.PORT = ORIGINAL_PORT
})

describe('app origin helpers', () => {
  it('prefers NEXT_PUBLIC_APP_URL when configured', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.pointsmax.com/path'
    process.env.VERCEL_URL = 'preview.pointsmax.com'

    expect(getConfiguredAppOrigin()).toBe('https://app.pointsmax.com')
    expect(getSafeAppOrigin('https://request.example.com/foo')).toBe('https://app.pointsmax.com')
  })

  it('falls back to request origin when app URL is missing', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.VERCEL_URL

    expect(getSafeAppOrigin('https://request.example.com/some/path')).toBe('https://request.example.com')
  })

  it('uses VERCEL_URL when present', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    process.env.VERCEL_URL = 'preview.pointsmax.com'

    expect(getConfiguredAppOrigin()).toBe('https://preview.pointsmax.com')
  })

  it('falls back to localhost with configured port in development', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.VERCEL_URL
    process.env.PORT = '4567'

    expect(getConfiguredAppOrigin()).toBe('http://localhost:4567')
    expect(getSafeAppOrigin()).toBe('http://localhost:4567')
  })
})
