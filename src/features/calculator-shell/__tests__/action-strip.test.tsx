import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CalculatorActionStrip } from '../ui/action-strip'
import { createActionStripHandlers } from '../application/create-action-strip-handlers'
import { createActionStripSlice } from '../application/use-action-strip-slice'

// Mock analytics module
vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

describe('calculator-shell action strip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('component interaction tests', () => {
    it('renders all action buttons when visible', () => {
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

      expect(screen.getByText('Next Steps')).toBeInTheDocument()
      expect(screen.getByText('Book Flight')).toBeInTheDocument()
      expect(screen.getByText('Share Plan')).toBeInTheDocument()
      expect(screen.getByText('Alert Me')).toBeInTheDocument()
    })

    it('does not render when not visible', () => {
      const { container } = render(
        <CalculatorActionStrip
          visible={false}
          region="us"
          onBook={vi.fn()}
          onShare={vi.fn()}
          onAlert={vi.fn()}
        />,
      )
      expect(container.firstChild).toBeNull()
    })

    it('fires onBook callback when Book Flight is clicked', () => {
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
      expect(onBook).toHaveBeenCalledTimes(1)
    })

    it('fires onShare callback when Share Plan is clicked', () => {
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

      fireEvent.click(screen.getByText('Share Plan'))
      expect(onShare).toHaveBeenCalledTimes(1)
    })

    it('fires onAlert callback when Alert Me is clicked', () => {
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

      fireEvent.click(screen.getByText('Alert Me'))
      expect(onAlert).toHaveBeenCalledTimes(1)
    })

    it('disables share button and shows loading text when shareBusy is true', () => {
      render(
        <CalculatorActionStrip
          visible
          region="us"
          shareBusy
          onBook={vi.fn()}
          onShare={vi.fn()}
          onAlert={vi.fn()}
        />,
      )

      const shareButton = screen.getByText('Sharing...')
      expect(shareButton).toBeDisabled()
    })

    it('shows share text when shareBusy is false', () => {
      render(
        <CalculatorActionStrip
          visible
          region="us"
          shareBusy={false}
          onBook={vi.fn()}
          onShare={vi.fn()}
          onAlert={vi.fn()}
        />,
      )

      expect(screen.getByText('Share Plan')).toBeInTheDocument()
    })

    it('handles all three actions in sequence', () => {
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
  })

  describe('application handler event mapping tests', () => {
    it('createActionStripHandlers emits deterministic event names for all actions', () => {
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

    it('createActionStripHandlers maps correct events for each action type', () => {
      const tracker = vi.fn()
      const callbacks = {
        onBook: vi.fn(),
        onShare: vi.fn(),
        onAlert: vi.fn(),
      }
      const context = { region: 'us' }
      const handlers = createActionStripHandlers(callbacks, context, tracker)

      // Test onBook event mapping
      handlers.onBook()
      expect(tracker).toHaveBeenNthCalledWith(1, 'calculator_cta_book_clicked', context)
      expect(callbacks.onBook).toHaveBeenCalled()

      // Test onShare event mapping
      handlers.onShare()
      expect(tracker).toHaveBeenNthCalledWith(2, 'calculator_cta_share_clicked', context)
      expect(callbacks.onShare).toHaveBeenCalled()

      // Test onAlert event mapping
      handlers.onAlert()
      expect(tracker).toHaveBeenNthCalledWith(3, 'calculator_cta_alert_clicked', context)
      expect(callbacks.onAlert).toHaveBeenCalled()
    })

    it('createActionStripHandlers passes region context correctly', () => {
      const tracker = vi.fn()
      const handlersUS = createActionStripHandlers(
        { onBook: vi.fn(), onShare: vi.fn(), onAlert: vi.fn() },
        { region: 'us' },
        tracker,
      )
      const handlersEU = createActionStripHandlers(
        { onBook: vi.fn(), onShare: vi.fn(), onAlert: vi.fn() },
        { region: 'eu' },
        tracker,
      )

      handlersUS.onBook()
      expect(tracker).toHaveBeenLastCalledWith('calculator_cta_book_clicked', { region: 'us' })

      handlersEU.onShare()
      expect(tracker).toHaveBeenLastCalledWith('calculator_cta_share_clicked', { region: 'eu' })
    })

    it('createActionStripSlice creates slice with correct state and actions', () => {
      const tracker = vi.fn()
      const callbacks = {
        onBook: vi.fn(),
        onShare: vi.fn(),
        onAlert: vi.fn(),
      }

      const slice = createActionStripSlice({
        visible: true,
        region: 'us',
        shareBusy: true,
        ...callbacks,
        tracker,
      })

      expect(slice.state.visible).toBe(true)
      expect(slice.state.shareBusy).toBe(true)
      expect(slice.state.context.region).toBe('us')

      // Test actions are wired with tracking
      slice.actions.onBook()
      expect(tracker).toHaveBeenCalledWith('calculator_cta_book_clicked', { region: 'us' })
      expect(callbacks.onBook).toHaveBeenCalled()
    })

    it('createActionStripSlice uses default shareBusy value', () => {
      const slice = createActionStripSlice({
        visible: true,
        region: 'us',
        onBook: vi.fn(),
        onShare: vi.fn(),
        onAlert: vi.fn(),
      })

      expect(slice.state.shareBusy).toBe(false)
    })

    it('createActionStripSlice uses default tracker when not provided', () => {
      const callbacks = {
        onBook: vi.fn(),
        onShare: vi.fn(),
        onAlert: vi.fn(),
      }

      // Should not throw when tracker is not provided
      const slice = createActionStripSlice({
        visible: true,
        region: 'us',
        ...callbacks,
      })

      // Actions should be callable without errors
      expect(() => slice.actions.onBook()).not.toThrow()
      expect(() => slice.actions.onShare()).not.toThrow()
      expect(() => slice.actions.onAlert()).not.toThrow()
    })

    it('tracks all three events with correct event names via slice', () => {
      const tracker = vi.fn()
      const slice = createActionStripSlice({
        visible: true,
        region: 'uk',
        onBook: vi.fn(),
        onShare: vi.fn(),
        onAlert: vi.fn(),
        tracker,
      })

      slice.actions.onBook()
      slice.actions.onShare()
      slice.actions.onAlert()

      const trackedEvents = tracker.mock.calls.map((call) => call[0])
      expect(trackedEvents).toContain('calculator_cta_book_clicked')
      expect(trackedEvents).toContain('calculator_cta_share_clicked')
      expect(trackedEvents).toContain('calculator_cta_alert_clicked')
    })
  })

  describe('slice integration tests', () => {
    it('useActionStripSlice hook returns state and actions', () => {
      // Since we cannot call hooks directly in non-React context,
      // we test the createActionStripSlice factory which shares the same logic
      const callbacks = {
        onBook: vi.fn(),
        onShare: vi.fn(),
        onAlert: vi.fn(),
      }

      const slice = createActionStripSlice({
        visible: true,
        region: 'us',
        shareBusy: false,
        ...callbacks,
      })

      expect(slice.state).toBeDefined()
      expect(slice.actions).toBeDefined()
      expect(typeof slice.actions.onBook).toBe('function')
      expect(typeof slice.actions.onShare).toBe('function')
      expect(typeof slice.actions.onAlert).toBe('function')
    })

    it('slice maintains callback behavior parity', () => {
      const tracker = vi.fn()
      const callbacks = {
        onBook: vi.fn(() => 'book-result'),
        onShare: vi.fn(() => 'share-result'),
        onAlert: vi.fn(() => 'alert-result'),
      }

      const slice = createActionStripSlice({
        visible: true,
        region: 'us',
        ...callbacks,
        tracker,
      })

      // Execute all actions
      slice.actions.onBook()
      slice.actions.onShare()
      slice.actions.onAlert()

      // Verify callbacks were invoked
      expect(callbacks.onBook).toHaveBeenCalledTimes(1)
      expect(callbacks.onShare).toHaveBeenCalledTimes(1)
      expect(callbacks.onAlert).toHaveBeenCalledTimes(1)

      // Verify tracking was invoked
      expect(tracker).toHaveBeenCalledTimes(3)
    })
  })
})
