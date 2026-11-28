import '@testing-library/jest-dom';

// Keep test environment deterministic for modules that validate env vars at import time.
process.env.NEXT_PUBLIC_APP_URL ||= 'https://pointsmax.test'
// Never send analytics from tests.
process.env.NEXT_PUBLIC_POSTHOG_KEY = 'off'

// Tests run against createTestDb(), whose schema is already applied, so the
// readiness gate is a no-op here. src/lib/db/ready.test.ts exercises the real gate.
vi.mock('@/lib/db/ready', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/ready')>()),
  ensureDatabaseReady: vi.fn(async () => {}),
}))
