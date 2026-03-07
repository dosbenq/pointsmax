import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminWorkflowHealthPage from './page'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('AdminWorkflowHealthPage', () => {
  const mockHealthData = {
    checked_at: new Date().toISOString(),
    configs: [
      { key: 'GEMINI_API_KEY', required: true, present: true },
      { key: 'RESEND_API_KEY', required: false, present: false },
    ],
    auth_branding: {
      configured: true,
      using_supabase_domain: true,
      message: 'Google OAuth will show a Supabase-hosted domain until Supabase Auth runs behind a custom PointsMax domain.',
    },
    knowledge_channel: {
      configured: true,
      url: 'https://www.youtube.com/@ConfiguredChannel',
      label: 'ConfiguredChannel',
    },
    summary: {
      required_present: 1,
      required_total: 1,
      ready: true,
    },
    db: {
      flight_watches_ready: true,
      total_watches: 10,
      active_watches: 5,
      knowledge_ready: true,
      knowledge_docs_count: 100,
      errors: [],
    },
    workflow: {
      event_name: 'workflow.healthcheck',
      endpoint: '/api/inngest',
      send_ready: true,
      failed_runs_24h: 2,
      last_success_at: new Date().toISOString(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealthData),
    })
  })

  it('renders metrics correctly after loading', async () => {
    render(<AdminWorkflowHealthPage />)

    // Check loading state
    expect(screen.getByText('Refreshing…')).toBeInTheDocument()

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText('Refreshing…')).not.toBeInTheDocument()
    })

    // Verify metrics
    expect(screen.getByText('Failed (24h)')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // failed_runs_24h

    expect(screen.getByText('Last Activity')).toBeInTheDocument()
    // Should show the formatted date. Since it's dynamic, we check for presence.
    expect(screen.getByText(/Last successful run/)).toBeInTheDocument()
  })

  it('handles test event action', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHealthData),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          run_id: 'run-123',
          event_ids: ['evt-123'],
          message: 'Healthcheck event sent. Verify run status in Inngest dashboard.',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHealthData),
      })

    render(<AdminWorkflowHealthPage />)

    await waitFor(() => {
      expect(screen.queryByText('Refreshing…')).not.toBeInTheDocument()
    })

    const testButton = screen.getByText('Run test event')
    fireEvent.click(testButton)

    expect(screen.getByText('Sending…')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Run test event')).toBeInTheDocument()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/workflow-health', { method: 'POST' })
  })

  it('shows error message on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed to load' }),
    })

    render(<AdminWorkflowHealthPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument()
    })
  })
})
