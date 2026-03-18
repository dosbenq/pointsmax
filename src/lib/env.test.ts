import { afterEach, describe, expect, it } from 'vitest'
import { shouldAssertServerEnvAtStartup } from './env'

const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_NEXT_PHASE = process.env.NEXT_PHASE

function restoreEnv() {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV
  }

  if (ORIGINAL_NEXT_PHASE === undefined) {
    delete process.env.NEXT_PHASE
  } else {
    process.env.NEXT_PHASE = ORIGINAL_NEXT_PHASE
  }
}

describe('env startup assertion guard', () => {
  afterEach(() => {
    restoreEnv()
  })

  it('skips assertion during the production build phase', () => {
    process.env.NODE_ENV = 'production'
    process.env.NEXT_PHASE = 'phase-production-build'

    expect(shouldAssertServerEnvAtStartup()).toBe(false)
  })

  it('allows assertion during production runtime', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.NEXT_PHASE

    expect(shouldAssertServerEnvAtStartup()).toBe(true)
  })

  it('does not assert outside production', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.NEXT_PHASE

    expect(shouldAssertServerEnvAtStartup()).toBe(false)
  })
})
