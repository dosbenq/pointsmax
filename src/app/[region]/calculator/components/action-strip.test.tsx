import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActionStrip } from './action-strip'
import * as analytics from '@/lib/analytics'

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

describe('ActionStrip', () => {
  const defaultProps = {
    visible: true,
    onBook: vi.fn(),
    onShare: vi.fn(),
    onAlert: vi.fn(),
    region: 'us',
    shareBusy: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly when visible', () => {
    render(<ActionStrip {...defaultProps} />)
    expect(screen.getByText('Next Steps')).toBeInTheDocument()
    expect(screen.getByText('Book Flight')).toBeInTheDocument()
    expect(screen.getByText('Share Plan')).toBeInTheDocument()
    expect(screen.getByText('Alert Me')).toBeInTheDocument()
  })

  it('does not render when not visible', () => {
    const { container } = render(<ActionStrip {...defaultProps} visible={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('tracks analytics for Book Flight', () => {
    render(<ActionStrip {...defaultProps} />)
    fireEvent.click(screen.getByText('Book Flight'))
    expect(analytics.trackEvent).toHaveBeenCalledWith('calculator_cta_book_clicked', { region: 'us' })
    expect(defaultProps.onBook).toHaveBeenCalled()
  })

  it('tracks analytics for Share Plan', () => {
    render(<ActionStrip {...defaultProps} />)
    fireEvent.click(screen.getByText('Share Plan'))
    expect(analytics.trackEvent).toHaveBeenCalledWith('calculator_cta_share_clicked', { region: 'us' })
    expect(defaultProps.onShare).toHaveBeenCalled()
  })

  it('tracks analytics for Alert Me', () => {
    render(<ActionStrip {...defaultProps} />)
    fireEvent.click(screen.getByText('Alert Me'))
    expect(analytics.trackEvent).toHaveBeenCalledWith('calculator_cta_alert_clicked', { region: 'us' })
    expect(defaultProps.onAlert).toHaveBeenCalled()
  })

  it('disables share button when sharing is busy', () => {
    render(<ActionStrip {...defaultProps} shareBusy={true} />)
    const shareButton = screen.getByText('Sharing...')
    expect(shareButton).toBeDisabled()
  })

  it('renders nothing when not visible (no-result state)', () => {
    const { container } = render(<ActionStrip {...defaultProps} visible={false} />)
    // Component should return null when not visible
    expect(container.firstChild).toBeNull()
  })

  it('renders action buttons with correct styling when visible', () => {
    const { container } = render(<ActionStrip {...defaultProps} />)
    const wrapper = container.firstChild as HTMLElement | null
    // Verify container exists with expected styling
    expect(wrapper).not.toBeNull()
    expect(wrapper).toHaveClass('pm-card')
    expect(wrapper).toHaveClass('border-pm-accent-border')
    // Verify all action buttons are present
    expect(screen.getByText('Book Flight')).toBeInTheDocument()
    expect(screen.getByText('Share Plan')).toBeInTheDocument()
    expect(screen.getByText('Alert Me')).toBeInTheDocument()
    // Verify button styling
    expect(screen.getByText('Book Flight')).toHaveClass('text-pm-bg')
    expect(screen.getByText('Alert Me')).toHaveClass('text-pm-ink-700')
  })
})
