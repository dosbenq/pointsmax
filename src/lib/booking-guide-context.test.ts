import { describe, expect, it } from 'vitest'
import {
  buildBookingGuidePrompt,
  sanitizeBookingGuideContext,
} from './booking-guide-context'

describe('booking-guide-context', () => {
  it('sanitizes context payloads and drops invalid balance rows', () => {
    const context = sanitizeBookingGuideContext({
      origin: 'jfk',
      destination: 'cdg',
      cabin: 'business',
      passengers: 2,
      start_date: '2026-06-01',
      end_date: '2026-06-10',
      program_name: 'Air Canada Aeroplan',
      transfer_chain: 'Chase Ultimate Rewards → Air Canada Aeroplan',
      has_real_availability: true,
      balances: [
        { program_name: 'Chase Ultimate Rewards', balance: 80000 },
        { program_name: 'Bad Row', balance: 0 },
      ],
    })

    expect(context).toEqual({
      origin: 'JFK',
      destination: 'CDG',
      cabin: 'business',
      passengers: 2,
      start_date: '2026-06-01',
      end_date: '2026-06-10',
      program_name: 'Air Canada Aeroplan',
      program_slug: undefined,
      estimated_miles: undefined,
      points_needed_from_wallet: undefined,
      transfer_chain: 'Chase Ultimate Rewards → Air Canada Aeroplan',
      transfer_is_instant: undefined,
      has_real_availability: true,
      availability_date: null,
      deep_link_url: null,
      deep_link_label: null,
      balances: [{ program_name: 'Chase Ultimate Rewards', balance: 80000 }],
    })
  })

  it('builds a prompt with actual booking facts when context exists', () => {
    const prompt = buildBookingGuidePrompt('Transfer Chase to Aeroplan', {
      origin: 'JFK',
      destination: 'CDG',
      cabin: 'business',
      passengers: 1,
      start_date: '2026-06-01',
      end_date: '2026-06-03',
      program_name: 'Air Canada Aeroplan',
      estimated_miles: 55000,
      points_needed_from_wallet: 55000,
      transfer_chain: 'Chase Ultimate Rewards → Air Canada Aeroplan',
      transfer_is_instant: true,
      has_real_availability: true,
      availability_date: '2026-06-02',
      deep_link_label: 'Air Canada',
      deep_link_url: 'https://www.aircanada.com/',
      balances: [{ program_name: 'Chase Ultimate Rewards', balance: 80000 }],
    })

    expect(prompt).toContain('Route: JFK -> CDG')
    expect(prompt).toContain('Recommended transfer path: Chase Ultimate Rewards → Air Canada Aeroplan')
    expect(prompt).toContain('Availability source: live availability found')
    expect(prompt).toContain('User wallet balances:')
    expect(prompt).toContain('- Chase Ultimate Rewards: 80,000 points')
  })
})
