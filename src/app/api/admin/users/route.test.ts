import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdminMock, logAdminActionMock, createAdminClientMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  logAdminActionMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}))

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: requireAdminMock,
  logAdminAction: logAdminActionMock,
}))
vi.mock('@/lib/supabase', () => ({ createAdminClient: createAdminClientMock }))

const { PATCH } = await import('./route')

function patch(body: unknown) {
  return PATCH(new Request('http://localhost/api/admin/users', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

function mockDb(result: { error: { message: string } | null }) {
  const eq = vi.fn().mockResolvedValue(result)
  const update = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ update }))
  createAdminClientMock.mockReturnValue({ from })
  return { from, update, eq }
}

describe('PATCH /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    requireAdminMock.mockResolvedValue({ error: null, adminEmail: 'admin@test.com' })
  })

  it('rejects requests from non-admins', async () => {
    const denied = new Response('Forbidden', { status: 403 })
    requireAdminMock.mockResolvedValue({ error: denied, adminEmail: null })

    expect((await patch({ user_id: 'user-1', tier: 'premium' })).status).toBe(403)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('validates the body', async () => {
    expect((await patch({ tier: 'premium' })).status).toBe(400)
    expect((await patch({ user_id: 'user-1', tier: 'gold' })).status).toBe(400)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('updates the tier and records an audit entry', async () => {
    const db = mockDb({ error: null })

    const res = await patch({ user_id: 'user-1', tier: 'premium' })

    expect(res.status).toBe(200)
    expect(db.from).toHaveBeenCalledWith('users')
    expect(db.update).toHaveBeenCalledWith({ tier: 'premium' })
    expect(db.eq).toHaveBeenCalledWith('id', 'user-1')
    expect(logAdminActionMock).toHaveBeenCalledWith('user.tier_update', 'user-1', { tier: 'premium' }, 'admin@test.com')
  })

  it('returns 500 without auditing when the update fails', async () => {
    mockDb({ error: { message: 'db down' } })

    expect((await patch({ user_id: 'user-1', tier: 'free' })).status).toBe(500)
    expect(logAdminActionMock).not.toHaveBeenCalled()
  })
})
