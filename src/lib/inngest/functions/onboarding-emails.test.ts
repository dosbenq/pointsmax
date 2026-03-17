import { describe, expect, it } from 'vitest'
import { pickLargestProgram, shouldSendFollowUp } from './onboarding-emails'

describe('onboarding-emails helpers', () => {
  it('detects when a follow-up email should still send', () => {
    const stale = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    expect(shouldSendFollowUp(stale, 3)).toBe(true)
    expect(shouldSendFollowUp(new Date().toISOString(), 3)).toBe(false)
  })

  it('picks the largest balance program', () => {
    const result = pickLargestProgram(
      [
        { program_id: 'a', balance: 12000 },
        { program_id: 'b', balance: 54000 },
      ],
      new Map([
        ['a', 'Aeroplan'],
        ['b', 'Amex MR'],
      ]),
    )

    expect(result).toEqual({ name: 'Amex MR', programId: 'b' })
  })
})
