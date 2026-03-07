import { describe, expect, it } from 'vitest'
import type { ProgramRow, TransferPartnerRow } from './types'
import {
  buildReachablePaths,
  buildTransferChain,
  calculatePointsNeededFromWallet,
} from './reachable-wallet'

const programs: ProgramRow[] = [
  {
    id: 'chase',
    name: 'Chase Ultimate Rewards',
    short_name: 'Chase UR',
    slug: 'chase-ur',
    color_hex: '#1177ff',
    type: 'transferable_points',
  },
  {
    id: 'amex',
    name: 'Amex Membership Rewards',
    short_name: 'Amex MR',
    slug: 'amex-mr',
    color_hex: '#33aa88',
    type: 'transferable_points',
  },
  {
    id: 'united',
    name: 'United MileagePlus',
    short_name: 'United',
    slug: 'united',
    color_hex: '#002244',
    type: 'airline_miles',
  },
]

const transferPartners: TransferPartnerRow[] = [
  {
    id: 'tp-1',
    from_program_id: 'chase',
    to_program_id: 'united',
    ratio_from: 1,
    ratio_to: 1,
    is_instant: true,
    transfer_time_max_hrs: 0,
  },
  {
    id: 'tp-2',
    from_program_id: 'amex',
    to_program_id: 'united',
    ratio_from: 1,
    ratio_to: 1,
    is_instant: true,
    transfer_time_max_hrs: 0,
  },
]

describe('reachable-wallet', () => {
  it('combines multiple wallet sources toward one airline program', () => {
    const programMap = new Map(programs.map((program) => [program.id, program]))
    const path = buildReachablePaths(
      [
        { program_id: 'chase', amount: 40000 },
        { program_id: 'amex', amount: 40000 },
      ],
      programMap,
      transferPartners,
    ).get('united')

    expect(path).toBeDefined()
    expect(path?.availableMiles).toBe(80000)
    expect(calculatePointsNeededFromWallet(path!, 70000)).toBe(70000)
    expect(buildTransferChain(path!, programMap.get('united')!)).toContain('Chase Ultimate Rewards')
    expect(buildTransferChain(path!, programMap.get('united')!)).toContain('Amex Membership Rewards')
  })

  it('prefers more efficient sources first when ratios differ', () => {
    const programMap = new Map(programs.map((program) => [program.id, program]))
    const path = buildReachablePaths(
      [
        { program_id: 'chase', amount: 60000 },
        { program_id: 'amex', amount: 25000 },
      ],
      programMap,
      [
        transferPartners[0],
        {
          ...transferPartners[1],
          ratio_from: 250,
          ratio_to: 200,
        },
      ],
    ).get('united')

    expect(path).toBeDefined()
    expect(calculatePointsNeededFromWallet(path!, 50000)).toBe(50000)
    expect(calculatePointsNeededFromWallet(path!, 70000)).toBe(72500)
  })
})
