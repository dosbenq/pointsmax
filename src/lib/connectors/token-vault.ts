// ============================================================
// PointsMax — Token Vault
//
// Single encryption / decryption boundary for all external
// provider credentials (OAuth tokens, API keys).
//
// SECURITY BOUNDARY: This module is the ONLY place in the
// codebase that touches raw credential material.  Callers
// receive opaque vault reference strings; they never handle
// plaintext tokens directly.
//
// Algorithm: AES-256-GCM with a random 12-byte IV per
// encryption operation.  The GCM auth tag provides integrity
// and authenticity verification on decryption.
//
// Key management:
//   • Set CONNECTOR_TOKEN_KEY to a 64-character hex string
//     (32 bytes) in your environment / Vercel secrets.
//   • Generate a key with:
//       node -e "require('crypto').randomBytes(32).toString('hex')" | pbcopy
//   • Never commit the key to source control.
// ============================================================

import crypto from 'crypto'
import type { VaultEntry } from '@/types/connectors'

const ALGORITHM = 'aes-256-gcm' as const
const IV_BYTES = 12   // 96-bit IV — recommended for GCM
const TAG_BYTES = 16  // 128-bit authentication tag

// ─────────────────────────────────────────────
// KEY LOADING
// ─────────────────────────────────────────────

function loadEncryptionKey(): Buffer {
  const hex = process.env.CONNECTOR_TOKEN_KEY
  if (!hex) {
    throw new TokenVaultConfigError(
      'CONNECTOR_TOKEN_KEY environment variable is not set. ' +
        'Generate one with: node -e "require(\'crypto\').randomBytes(32).toString(\'hex\')"',
    )
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new TokenVaultConfigError(
      'CONNECTOR_TOKEN_KEY must be a 64-character hex string (32 bytes)',
    )
  }
  return Buffer.from(hex, 'hex')
}

// ─────────────────────────────────────────────
// ENCRYPT / DECRYPT
// ─────────────────────────────────────────────

/**
 * Encrypt a plaintext credential string.
 *
 * Returns an opaque vault reference string that can be safely stored
 * in the connected_accounts.token_vault_ref column.  The reference
 * encodes the IV, ciphertext, and GCM auth tag as base64 JSON.
 */
export function encryptToken(plaintext: string): string {
  const key = loadEncryptionKey()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_BYTES,
  })

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const entry: VaultEntry = {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }

  return JSON.stringify(entry)
}

/**
 * Decrypt a vault reference string produced by encryptToken.
 *
 * Throws TokenVaultDecryptError if the reference is malformed or if
 * GCM authentication fails (tampered ciphertext or wrong key).
 */
export function decryptToken(vaultRef: string): string {
  const key = loadEncryptionKey()

  let entry: VaultEntry
  try {
    entry = JSON.parse(vaultRef) as VaultEntry
  } catch {
    throw new TokenVaultDecryptError('vault reference is not valid JSON')
  }

  if (entry.ciphertext === undefined || entry.iv === undefined || entry.tag === undefined) {
    throw new TokenVaultDecryptError('vault reference is missing required fields')
  }

  try {
    const iv = Buffer.from(entry.iv, 'base64')
    const tag = Buffer.from(entry.tag, 'base64')
    const ciphertext = Buffer.from(entry.ciphertext, 'base64')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: TAG_BYTES,
    })
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return decrypted.toString('utf8')
  } catch (cause) {
    throw new TokenVaultDecryptError(
      'decryption failed — the vault reference may be corrupted or the key is wrong',
      cause instanceof Error ? cause : undefined,
    )
  }
}

/**
 * Rotate a vault reference to a new encryption under the current key.
 * Useful when the plaintext stays the same but the IV should change
 * (e.g. periodic rotation policy).
 */
export function rotateToken(vaultRef: string): string {
  const plaintext = decryptToken(vaultRef)
  return encryptToken(plaintext)
}

// ─────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────

export class TokenVaultConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenVaultConfigError'
  }
}

export class TokenVaultDecryptError extends Error {
  constructor(message: string, cause?: Error) {
    super(message)
    this.name = 'TokenVaultDecryptError'
    if (cause) this.cause = cause
  }
}
