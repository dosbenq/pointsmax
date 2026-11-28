// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { columnsOf } from './columns'
import { userPreferences } from './schema'
import { createTestDb, seedUser } from '@/test/utils/test-db'

describe('columnsOf', () => {
  it('selects every column keyed by its snake_case database name', async () => {
    const db = await createTestDb()
    const pat = await seedUser(db, 'pat')
    await db.insert(userPreferences).values({ userId: pat.userId, homeAirport: 'SFO', preferredAirlines: ['UA'] })

    const [prefs] = await db.select(columnsOf(userPreferences)).from(userPreferences)
    expect(prefs).toMatchObject({ user_id: pat.userId, home_airport: 'SFO', preferred_cabin: 'any', preferred_airlines: ['UA'] })
    expect(prefs).not.toHaveProperty('homeAirport')
  }, 30_000)
})
