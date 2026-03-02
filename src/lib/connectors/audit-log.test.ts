import { describe, it, expect, vi, beforeEach } from 'vitest'
import { emitAuditEvent } from './audit-log'
import type { AuditPersistence, ConnectorAuditEvent } from './audit-log'

// ─────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

import { logInfo, logError } from '@/lib/logger'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeEvent(overrides: Partial<ConnectorAuditEvent> = {}): ConnectorAuditEvent {
  return {
    userId: 'user-row-1',
    accountId: 'acct-001',
    provider: 'amex',
    eventType: 'disconnect',
    actor: 'user',
    ...overrides,
  }
}

function makePersistence(insertImpl?: () => Promise<void>): AuditPersistence {
  return {
    insert: vi.fn().mockImplementation(insertImpl ?? (() => Promise.resolve())),
  }
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('emitAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls persistence.insert with the correct event data', async () => {
    const persistence = makePersistence()
    const event = makeEvent({ eventType: 'disconnect', metadata: { reason: 'user_request' } })

    await emitAuditEvent(persistence, event)

    expect(persistence.insert).toHaveBeenCalledOnce()
    expect(persistence.insert).toHaveBeenCalledWith(event)
  })

  it('logs the event via logInfo on success', async () => {
    const persistence = makePersistence()
    const event = makeEvent({ eventType: 'connect' })

    await emitAuditEvent(persistence, event)

    expect(logInfo).toHaveBeenCalledWith(
      'connector_audit_event',
      expect.objectContaining({
        eventType: 'connect',
        provider: 'amex',
        accountId: 'acct-001',
        actor: 'user',
      }),
    )
  })

  it('accepts null accountId for post-deletion events', async () => {
    const persistence = makePersistence()
    const event = makeEvent({ accountId: null, eventType: 'delete' })

    await emitAuditEvent(persistence, event)

    expect(persistence.insert).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: null }),
    )
  })

  it('supports all actor types', async () => {
    for (const actor of ['user', 'system', 'admin'] as const) {
      const persistence = makePersistence()
      await emitAuditEvent(persistence, makeEvent({ actor }))
      expect(persistence.insert).toHaveBeenCalledWith(
        expect.objectContaining({ actor }),
      )
    }
  })

  it('does NOT throw when persistence.insert fails', async () => {
    const persistence = makePersistence(() => Promise.reject(new Error('DB write failed')))
    const event = makeEvent()

    await expect(emitAuditEvent(persistence, event)).resolves.toBeUndefined()
  })

  it('logs an error via logError when persistence fails', async () => {
    const persistence = makePersistence(() => Promise.reject(new Error('connection timeout')))
    const event = makeEvent({ eventType: 'sync', provider: 'chase' })

    await emitAuditEvent(persistence, event)

    expect(logError).toHaveBeenCalledWith(
      'connector_audit_event_failed',
      expect.objectContaining({
        eventType: 'sync',
        provider: 'chase',
        error: 'connection timeout',
      }),
    )
  })

  it('does not call logInfo when persistence fails', async () => {
    const persistence = makePersistence(() => Promise.reject(new Error('oops')))
    await emitAuditEvent(persistence, makeEvent())

    expect(logInfo).not.toHaveBeenCalled()
  })

  it('passes metadata through to persistence unchanged', async () => {
    const persistence = makePersistence()
    const metadata = { ip: '1.2.3.4', userAgent: 'Mozilla/5.0', reason: 'manual' }
    await emitAuditEvent(persistence, makeEvent({ metadata }))

    expect(persistence.insert).toHaveBeenCalledWith(
      expect.objectContaining({ metadata }),
    )
  })
})
