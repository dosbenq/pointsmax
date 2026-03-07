import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIChat } from './ai-chat'
import type { ChatMsg } from '../hooks/use-calculator-state'

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

describe('AIChat Component', () => {
  const defaultProps = {
    chatMessages: [] as ChatMsg[],
    chatInput: '',
    aiLoading: false,
    aiStatus: '',
    aiError: null,
    blockedReason: null,
    canUseAdvisor: true,
    hasCalculatorResult: true,
    result: null,
    user: { email: 'test@example.com' },
    chatEndRef: { current: null } as React.RefObject<HTMLDivElement | null>,
    onChatInputChange: vi.fn(),
    onSendMessage: vi.fn(),
    onRetryLastMessage: vi.fn(),
    onClearChat: vi.fn(),
    onSwitchPanel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly in initial state', () => {
    render(<AIChat {...defaultProps} />)
    expect(screen.getByText('AI Points Advisor')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/I want to fly business class to Tokyo/)).toBeInTheDocument()
  })

  it('renders clarifying messages from AI', () => {
    const chatMessages: ChatMsg[] = [
      {
        role: 'ai',
        payload: {
          type: 'clarifying',
          message: 'Where would you like to go?',
          questions: ['What is your destination?', 'When do you want to travel?'],
        },
      },
    ]
    render(<AIChat {...defaultProps} chatMessages={chatMessages} />)
    expect(screen.getByText('Where would you like to go?')).toBeInTheDocument()
    expect(screen.getByText('What is your destination?')).toBeInTheDocument()
    expect(screen.getByText('When do you want to travel?')).toBeInTheDocument()
  })

  it('renders recommendation messages from AI', () => {
    const chatMessages: ChatMsg[] = [
      {
        role: 'ai',
        payload: {
          type: 'recommendation',
          headline: 'Fly Business to Tokyo',
          reasoning: 'Great value on JAL',
          flight: {
            airline: 'JAL',
            cabin: 'Business',
            route: 'JFK-HND',
            points_needed: '60,000',
            transfer_chain: 'Amex -> BA',
            notes: 'Book via BA Executive Club',
          },
          hotel: null,
          total_summary: '120k points total',
          steps: ['Step 1', 'Step 2'],
          tip: 'Use a calendar search',
          links: [{ label: 'Book now', url: 'https://example.com' }],
        },
      },
    ]
    render(<AIChat {...defaultProps} chatMessages={chatMessages} />)
    expect(screen.getByText('Fly Business to Tokyo')).toBeInTheDocument()
    expect(screen.getByText('Great value on JAL')).toBeInTheDocument()
    expect(screen.getByText('JFK-HND')).toBeInTheDocument()
    expect(screen.getByText('60,000')).toBeInTheDocument()
    expect(screen.getByText('Book now ↗')).toBeInTheDocument()
  })

  it('renders recommendation metadata when provided', () => {
    const chatMessages: ChatMsg[] = [
      {
        role: 'ai',
        payload: {
          type: 'recommendation',
          headline: 'Hotel in Maui',
          reasoning: 'Grand Wailea value',
          flight: null,
          hotel: {
            name: 'Grand Wailea',
            chain: 'Hilton',
            points_per_night: '95,000',
            transfer_chain: 'Amex -> Hilton',
            notes: 'Standard room',
          },
          total_summary: '475k points total',
          steps: ['Step 1'],
          tip: 'Book 5th night free',
          links: [],
          metadata: {
            freshness: '2026-02-28T23:39:05Z',
            source: 'PointsMax API',
            confidence: 'high',
          },
        },
      },
    ]
    render(<AIChat {...defaultProps} chatMessages={chatMessages} />)
    
    expect(screen.getByText(/Source: PointsMax API/)).toBeInTheDocument()
    expect(screen.getByText(/Trust: high/)).toBeInTheDocument()
    expect(screen.getByText(/Updated/)).toBeInTheDocument()
  })

  it('displays actionable fallback message when aiError is present', () => {
    const aiError = 'Rate limit exceeded'
    render(<AIChat {...defaultProps} aiError={aiError} />)
    
    expect(screen.getByText('Points Advisor is temporarily unavailable')).toBeInTheDocument()
    expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
    
    const rawResultsBtn = screen.getByText('View non-AI results')
    expect(rawResultsBtn).toBeInTheDocument()
    
    fireEvent.click(rawResultsBtn)
    expect(defaultProps.onSwitchPanel).toHaveBeenCalled()
  })

  it('shows loading state with status message', () => {
    render(<AIChat {...defaultProps} aiLoading={true} aiStatus="Analyzing..." />)
    expect(screen.getByText('Analyzing...')).toBeInTheDocument()
  })

  it('shows guest limit message and disables send when blocked', () => {
    render(<AIChat {...defaultProps} blockedReason="Sign in to continue." canUseAdvisor={false} chatInput="hello" />)
    expect(screen.getByText('Guest advisor limit reached')).toBeInTheDocument()
    expect(screen.getByText('Sign in to continue.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('retries the last actual request when retry is clicked', () => {
    render(<AIChat {...defaultProps} aiError="temporary" />)
    fireEvent.click(screen.getByText('Retry'))
    expect(defaultProps.onRetryLastMessage).toHaveBeenCalled()
    expect(defaultProps.onSendMessage).not.toHaveBeenCalled()
  })
})
