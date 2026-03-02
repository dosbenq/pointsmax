// ============================================================
// PointsMax — Connector Audit Log
//
// Emits structured lifecycle events for connected-account
// operations: connect, disconnect, sync, manual_override,
// delete, token_revoke, auth_error.
//
// Design principles:
//   • Injectable persistence (AuditPersistence) keeps the
//     emitter testable without a real DB connection.
//   • emitAuditEvent never throws — failures are logged but
//     must not block the primary operation (e.g. disconnect).
//   • Metadata must be stripped of all credential material
//     before being passed here.
// ============================================================

import { logInfo, logError } from '@/lib/logger'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

/** All supported audit event kinds for the connector lifecycle. */
export type AuditEventType =
  | 'connect'
  | 'disconnect'
  | 'sync'
  | 'manual_override'
  | 'delete'
  | 'token_revoke'
  | 'auth_error'

/** Who triggered the event. */
export type AuditActor = 'user' | 'system' | 'admin'

/** A single auditable event in the connector lifecycle. */
export interface ConnectorAuditEvent {
  /** Internal user UUID (matches users.id, not auth.uid). */
  userId: string
  /** Connected account UUID — null when the account no longer exists. */
  accountId: string | null
  /** Provider slug (e.g. 'amex', 'chase'). */
  provider: string
  /** What happened. */
  eventType: AuditEventType
  /** Who caused the event. */
  actor: AuditActor
  /** Stripped, credential-free context for this specific event. */
  metadata?: Record<string, unknown>
}

/** Injectable persistence interface — production uses Supabase. */
export interface AuditPersistence {
  insert(event: ConnectorAuditEvent): Promise<void>
}

// ─────────────────────────────────────────────
// EMITTER
// ─────────────────────────────────────────────

/**
 * Emit a connector lifecycle audit event.
 *
 * This function is intentionally resilient: if persistence.insert()
 * fails, the error is logged at the 'error' level but is NOT
 * re-thrown.  The primary operation (disconnect, delete, etc.)
 * must always proceed regardless of audit write failures.
 */
export async function emitAuditEvent(
  persistence: AuditPersistence,
  event: ConnectorAuditEvent,
): Promise<void> {
  try {
    await persistence.insert(event)
    logInfo('connector_audit_event', {
      eventType: event.eventType,
      provider: event.provider,
      accountId: event.accountId,
      actor: event.actor,
    })
  } catch (err) {
    logError('connector_audit_event_failed', {
      eventType: event.eventType,
      provider: event.provider,
      accountId: event.accountId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
