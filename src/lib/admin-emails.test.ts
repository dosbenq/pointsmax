import { afterEach, describe, expect, it } from 'vitest'

const originalAdminEmail = process.env.ADMIN_EMAIL
const originalAdminAllowlist = process.env.ADMIN_ALLOWED_EMAILS
const originalPublicAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
const originalPublicAdminAllowlist = process.env.NEXT_PUBLIC_ADMIN_ALLOWED_EMAILS

afterEach(() => {
  process.env.ADMIN_EMAIL = originalAdminEmail
  process.env.ADMIN_ALLOWED_EMAILS = originalAdminAllowlist
  process.env.NEXT_PUBLIC_ADMIN_EMAIL = originalPublicAdminEmail
  process.env.NEXT_PUBLIC_ADMIN_ALLOWED_EMAILS = originalPublicAdminAllowlist
})

describe('admin email allowlists', () => {
  it('prefers explicit server allowlists over the single admin email', async () => {
    process.env.ADMIN_EMAIL = 'owner@example.com'
    process.env.ADMIN_ALLOWED_EMAILS = 'owner@example.com,ops@example.com'

    const mod = await import('./admin-emails')

    expect(mod.isServerAdminEmail('ops@example.com')).toBe(true)
    expect(mod.isServerAdminEmail('other@example.com')).toBe(false)
  })

  it('supports client allowlists with fallback to NEXT_PUBLIC_ADMIN_EMAIL', async () => {
    process.env.NEXT_PUBLIC_ADMIN_EMAIL = 'owner@example.com'
    process.env.NEXT_PUBLIC_ADMIN_ALLOWED_EMAILS = 'owner@example.com,ops@example.com'

    const mod = await import('./admin-emails')

    expect(mod.isClientAdminEmail('owner@example.com')).toBe(true)
    expect(mod.isClientAdminEmail('ops@example.com')).toBe(true)
    expect(mod.isClientAdminEmail('other@example.com')).toBe(false)
  })
})
