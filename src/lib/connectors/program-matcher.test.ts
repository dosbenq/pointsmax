import { describe, expect, it } from 'vitest'
import { matchProgramByName } from './program-matcher'

const programs = [
  { id: 'prog-chase', name: 'Chase Ultimate Rewards', slug: 'chase-ultimate-rewards' },
  { id: 'prog-amex', name: 'Amex Membership Rewards', slug: 'amex-membership-rewards' },
  { id: 'prog-united', name: 'United MileagePlus', slug: 'united-mileageplus' },
  { id: 'prog-hdfc', name: 'HDFC Reward Points', slug: 'hdfc-reward-points' },
  { id: 'prog-air-india', name: 'Air India Maharaja Club', slug: 'air-india-maharaja-club' },
] as const

describe('matchProgramByName', () => {
  it('matches an exact slug', () => {
    expect(matchProgramByName('chase-ultimate-rewards', [...programs])).toEqual({
      program_id: 'prog-chase',
      program_name: 'Chase Ultimate Rewards',
      confidence: 'exact',
    })
  })

  it('matches a hardcoded alias', () => {
    expect(matchProgramByName('amex mr', [...programs])).toEqual({
      program_id: 'prog-amex',
      program_name: 'Amex Membership Rewards',
      confidence: 'alias',
    })
  })

  it('matches fuzzily when token overlap is high enough', () => {
    expect(matchProgramByName('United Airlines MileagePlus', [...programs])).toEqual({
      program_id: 'prog-united',
      program_name: 'United MileagePlus',
      confidence: 'fuzzy',
    })
  })

  it('matches India aliases', () => {
    expect(matchProgramByName('HDFC Bank', [...programs])).toEqual({
      program_id: 'prog-hdfc',
      program_name: 'HDFC Reward Points',
      confidence: 'alias',
    })
  })

  it('returns null for a low-confidence input', () => {
    expect(matchProgramByName('xyzunknown', [...programs])).toBeNull()
  })
})
