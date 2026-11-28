import { vi } from 'vitest'
import type * as AuthModule from '@/lib/auth'

/**
 * Module factory for vi.mock('@/lib/auth', ...): keeps the real database
 * helpers but makes the session lookup controllable via getSessionUser.
 *
 *   vi.mock('@/lib/auth', (importOriginal) => mockAuthModule(importOriginal))
 *   vi.mocked(getSessionUser).mockResolvedValue(sessionFor(user))
 */
export async function mockAuthModule(importOriginal: () => Promise<unknown>) {
  const actual = await importOriginal() as typeof AuthModule
  const getSessionUser = vi.fn<typeof AuthModule.getSessionUser>(async () => null)
  const getAuthContext: typeof AuthModule.getAuthContext = async (requestHeaders) => {
    const user = await getSessionUser(requestHeaders)
    if (!user) return { user: null, authUserId: null, profileId: null }
    return { user, authUserId: user.id, profileId: await actual.getUserRowId(user.id) }
  }
  return { ...actual, getSessionUser, getAuthContext }
}
