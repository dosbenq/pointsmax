import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  encryptToken,
  decryptToken,
  rotateToken,
  TokenVaultConfigError,
  TokenVaultDecryptError,
} from './token-vault'

// ─────────────────────────────────────────────
// TEST KEY SETUP
// ─────────────────────────────────────────────

// 64-char hex = 32-byte key — suitable for AES-256
const TEST_KEY = 'a'.repeat(64)

function withKey(key: string | undefined, fn: () => void) {
  const original = process.env.CONNECTOR_TOKEN_KEY
  if (key === undefined) {
    delete process.env.CONNECTOR_TOKEN_KEY
  } else {
    process.env.CONNECTOR_TOKEN_KEY = key
  }
  try {
    fn()
  } finally {
    if (original === undefined) {
      delete process.env.CONNECTOR_TOKEN_KEY
    } else {
      process.env.CONNECTOR_TOKEN_KEY = original
    }
  }
}

// ─────────────────────────────────────────────
// encryptToken / decryptToken
// ─────────────────────────────────────────────

describe('encryptToken + decryptToken', () => {
  beforeEach(() => {
    process.env.CONNECTOR_TOKEN_KEY = TEST_KEY
  })

  afterEach(() => {
    delete process.env.CONNECTOR_TOKEN_KEY
  })

  it('round-trips a short token', () => {
    const plaintext = 'tok_amex_abc123'
    const vaultRef = encryptToken(plaintext)
    expect(decryptToken(vaultRef)).toBe(plaintext)
  })

  it('round-trips a long token (e.g. OAuth refresh token)', () => {
    const plaintext = 'rt_' + 'x'.repeat(512)
    expect(decryptToken(encryptToken(plaintext))).toBe(plaintext)
  })

  it('round-trips an empty string', () => {
    expect(decryptToken(encryptToken(''))).toBe('')
  })

  it('round-trips a token containing special characters', () => {
    const plaintext = 'Bearer eyJhb/GCI=+foo&bar="baz"'
    expect(decryptToken(encryptToken(plaintext))).toBe(plaintext)
  })

  it('produces a JSON string containing iv, ciphertext, tag fields', () => {
    const vaultRef = encryptToken('tok')
    const parsed = JSON.parse(vaultRef)
    expect(parsed).toHaveProperty('iv')
    expect(parsed).toHaveProperty('ciphertext')
    expect(parsed).toHaveProperty('tag')
  })

  it('produces different ciphertext on each call (random IV)', () => {
    const ref1 = encryptToken('same-plaintext')
    const ref2 = encryptToken('same-plaintext')
    expect(ref1).not.toBe(ref2)
    // But both decrypt to the same plaintext
    expect(decryptToken(ref1)).toBe('same-plaintext')
    expect(decryptToken(ref2)).toBe('same-plaintext')
  })

  it('does not expose the plaintext in the vault reference', () => {
    const secret = 'super-secret-api-key-42'
    const vaultRef = encryptToken(secret)
    expect(vaultRef).not.toContain(secret)
  })
})

// ─────────────────────────────────────────────
// Key validation
// ─────────────────────────────────────────────

describe('encryptToken key validation', () => {
  it('throws TokenVaultConfigError when key is missing', () => {
    withKey(undefined, () => {
      expect(() => encryptToken('test')).toThrow(TokenVaultConfigError)
    })
  })

  it('throws TokenVaultConfigError when key is too short', () => {
    withKey('a'.repeat(32), () => {
      expect(() => encryptToken('test')).toThrow(TokenVaultConfigError)
    })
  })

  it('throws TokenVaultConfigError when key contains non-hex characters', () => {
    withKey('z'.repeat(64), () => {
      expect(() => encryptToken('test')).toThrow(TokenVaultConfigError)
    })
  })
})

describe('decryptToken key validation', () => {
  it('throws TokenVaultConfigError when key is missing at decrypt time', () => {
    process.env.CONNECTOR_TOKEN_KEY = TEST_KEY
    const vaultRef = encryptToken('tok')
    withKey(undefined, () => {
      expect(() => decryptToken(vaultRef)).toThrow(TokenVaultConfigError)
    })
  })
})

// ─────────────────────────────────────────────
// Tamper / malformed input detection
// ─────────────────────────────────────────────

describe('decryptToken error handling', () => {
  beforeEach(() => {
    process.env.CONNECTOR_TOKEN_KEY = TEST_KEY
  })

  afterEach(() => {
    delete process.env.CONNECTOR_TOKEN_KEY
  })

  it('throws TokenVaultDecryptError for non-JSON input', () => {
    expect(() => decryptToken('not-json')).toThrow(TokenVaultDecryptError)
  })

  it('throws TokenVaultDecryptError for JSON missing required fields', () => {
    expect(() => decryptToken(JSON.stringify({ iv: 'abc' }))).toThrow(TokenVaultDecryptError)
  })

  it('throws TokenVaultDecryptError when ciphertext is tampered', () => {
    const vaultRef = encryptToken('original')
    const parsed = JSON.parse(vaultRef)
    // Flip a character in the ciphertext
    parsed.ciphertext = parsed.ciphertext.slice(0, -4) + 'XXXX'
    expect(() => decryptToken(JSON.stringify(parsed))).toThrow(TokenVaultDecryptError)
  })

  it('throws TokenVaultDecryptError when auth tag is tampered', () => {
    const vaultRef = encryptToken('original')
    const parsed = JSON.parse(vaultRef)
    parsed.tag = 'AAAAAAAAAAAAAAAAAAAAAA=='  // wrong tag
    expect(() => decryptToken(JSON.stringify(parsed))).toThrow(TokenVaultDecryptError)
  })

  it('throws TokenVaultDecryptError when a different key is used', () => {
    const vaultRef = encryptToken('tok')
    // Switch to a different key for decryption
    process.env.CONNECTOR_TOKEN_KEY = 'b'.repeat(64)
    expect(() => decryptToken(vaultRef)).toThrow(TokenVaultDecryptError)
  })
})

// ─────────────────────────────────────────────
// rotateToken
// ─────────────────────────────────────────────

describe('rotateToken', () => {
  beforeEach(() => {
    process.env.CONNECTOR_TOKEN_KEY = TEST_KEY
  })

  afterEach(() => {
    delete process.env.CONNECTOR_TOKEN_KEY
  })

  it('produces a new vault reference that decrypts to the same plaintext', () => {
    const plaintext = 'tok_rotate_me'
    const original = encryptToken(plaintext)
    const rotated = rotateToken(original)
    expect(rotated).not.toBe(original)
    expect(decryptToken(rotated)).toBe(plaintext)
  })

  it('re-encrypts with a fresh IV', () => {
    const original = encryptToken('tok')
    const rotated = rotateToken(original)
    expect(JSON.parse(rotated).iv).not.toBe(JSON.parse(original).iv)
  })
})
