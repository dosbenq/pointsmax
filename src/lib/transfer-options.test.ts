import { describe, expect, it } from 'vitest'
import { getCatalogProgramBySlug, getCatalogTransferPartners } from '@/lib/catalog'
import { buildTransferOptions, convert } from './transfer-options'

const id = (slug: string) => getCatalogProgramBySlug(slug)!.id
const partner = (from: string, to: string) =>
  getCatalogTransferPartners().find((p) => p.from_program_id === id(from) && p.to_program_id === id(to))!

describe('convert', () => {
  it('applies the ratio in whole transfer blocks, then the bonus', () => {
    expect(convert(120_000, 1, 1, null)).toBe(120_000)
    expect(convert(100_001, 2, 1, null)).toBe(50_000)
    expect(convert(10_000, 1, 1, 30)).toBe(13_000)
    expect(convert(0, 1, 1, null)).toBe(0)
  })
})

describe('buildTransferOptions', () => {
  it('lists the airline programs your points reach, with the exact conversion', () => {
    const options = buildTransferOptions([{ program_id: id('chase-ur'), amount: 120_000 }], 'US')
    const aeroplan = options.find((o) => o.program_slug === 'aeroplan')!
    const link = partner('chase-ur', 'aeroplan')

    expect(aeroplan.paths).toEqual([
      expect.objectContaining({
        from_program_name: 'Chase Ultimate Rewards',
        points: 120_000,
        ratio_from: link.ratio_from,
        ratio_to: link.ratio_to,
        bonus_pct: null,
        miles: convert(120_000, link.ratio_from, link.ratio_to, null),
      }),
    ])
    expect(options.every((o) => o.paths.length > 0 || o.miles_held > 0)).toBe(true)
  })

  it('adds a verified bonus running today and lists that program first', () => {
    const link = partner('chase-ur', 'flying-blue')
    const options = buildTransferOptions(
      [{ program_id: id('chase-ur'), amount: 50_000 }],
      'US',
      [{ transfer_partner_id: link.id, bonus_pct: 30, end_date: '2026-12-31' }],
    )

    expect(options[0].program_slug).toBe('flying-blue')
    expect(options[0].paths[0]).toMatchObject({ bonus_pct: 30, bonus_ends: '2026-12-31', miles: convert(50_000, link.ratio_from, link.ratio_to, 30) })
  })

  it('combines several sources into one airline and counts miles already held', () => {
    const options = buildTransferOptions(
      [
        { program_id: id('chase-ur'), amount: 10_000 },
        { program_id: id('amex-mr'), amount: 20_000 },
        { program_id: id('aeroplan'), amount: 5_000 },
      ],
      'US',
    )
    const aeroplan = options.find((o) => o.program_slug === 'aeroplan')!
    expect(aeroplan.miles_held).toBe(5_000)
    expect(aeroplan.paths.map((p) => p.from_program_name).sort()).toEqual(['Amex Membership Rewards', 'Chase Ultimate Rewards'])
    expect(aeroplan.miles_available).toBe(5_000 + aeroplan.paths.reduce((sum, p) => sum + p.miles, 0))
  })

  it('ignores unknown programs, empty balances and hotel programs', () => {
    expect(buildTransferOptions([{ program_id: 'nope', amount: 1000 }], 'US')).toEqual([])
    expect(buildTransferOptions([{ program_id: id('chase-ur'), amount: 0 }], 'US')).toEqual([])
    const options = buildTransferOptions([{ program_id: id('chase-ur'), amount: 50_000 }], 'US')
    expect(options.some((o) => o.program_slug === 'hyatt')).toBe(false)
  })

  it('never returns modeled values (prices, cents per point, cash value)', () => {
    const json = JSON.stringify(buildTransferOptions([{ program_id: id('chase-ur'), amount: 100_000 }], 'US'))
    for (const modeled of ['estimated', 'cpp', 'cash_value', 'value_cents', 'is_reachable', 'points_needed']) {
      expect(json).not.toContain(modeled)
    }
  })
})
