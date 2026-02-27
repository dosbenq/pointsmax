import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalculatorActionStrip } from '../ui/action-strip'
import { createActionStripHandlers } from '../application/create-action-strip-handlers'

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

describe('calculator-shell action strip', () => {
  it('renders and fires callbacks', () => {
    const onBook = vi.fn()
    const onShare = vi.fn()
    const onAlert = vi.fn()

    render(
      <CalculatorActionStrip
        visible
        region="us"
        onBook={onBook}
        onShare={onShare}
        onAlert={onAlert}
      />,
    )

    fireEvent.click(screen.getByText('Book Flight'))
    fireEvent.click(screen.getByText('Share Plan'))
    fireEvent.click(screen.getByText('Alert Me'))

    expect(onBook).toHaveBeenCalledTimes(1)
    expect(onShare).toHaveBeenCalledTimes(1)
    expect(onAlert).toHaveBeenCalledTimes(1)
  })

  it('createActionStripHandlers emits deterministic event names', () => {
    const tracker = vi.fn()
    const handlers = createActionStripHandlers(
      { onBook: vi.fn(), onShare: vi.fn(), onAlert: vi.fn() },
      { region: 'in' },
      tracker,
    )

    handlers.onBook()
    handlers.onShare()
    handlers.onAlert()

    expect(tracker.mock.calls.map((call) => call[0])).toEqual([
      'calculator_cta_book_clicked',
      'calculator_cta_share_clicked',
      'calculator_cta_alert_clicked',
    ])
    expect(tracker.mock.calls.every((call) => call[1].region === 'in')).toBe(true)
  })
})
