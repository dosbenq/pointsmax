import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

const mockExtractFromPdf = vi.fn()

vi.mock('@/lib/connectors/statement-parser/pdf-extractor', () => ({
  extractFromPdf: mockExtractFromPdf,
}))

vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

const { POST } = await import('./route')

function installDefaultDbMocks() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'programs') {
      return {
        select: () => ({
          eq: async () => ({
            data: [{ id: 'prog-chase', name: 'Chase Ultimate Rewards', slug: 'chase-ultimate-rewards' }],
            error: null,
          }),
        }),
      }
    }
    if (table === 'program_name_aliases') {
      return {
        select: async () => ({
          data: [{ alias: 'chase ur', program_slug: 'chase-ultimate-rewards' }],
          error: null,
        }),
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })
}

describe('POST /api/connectors/ingest/pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installDefaultDbMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const request = new NextRequest('http://localhost/api/connectors/ingest/pdf', { method: 'POST' })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('returns 400 when the file field is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user' } } })
    const request = {
      formData: async () => new FormData(),
      headers: new Headers(),
    } as unknown as NextRequest

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 422 when extraction fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user' } } })
    mockExtractFromPdf.mockResolvedValue({ ok: false, error: 'Could not read PDF. Try a text export instead.' })

    const formData = new FormData()
    formData.append('file', new File(['fake-pdf'], 'statement.pdf', { type: 'application/pdf' }))
    const request = {
      formData: async () => formData,
      headers: new Headers(),
    } as unknown as NextRequest

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.code).toBe('PDF_PARSE_FAILED')
  })

  it('returns candidates for a valid PDF upload', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user' } } })
    mockExtractFromPdf.mockResolvedValue({
      ok: true,
      page_count: 2,
      char_count: 48,
      candidates: [
        {
          raw_line: 'Chase UR Points Balance: 45,234',
          balance: 45234,
          program_hint: 'Chase UR',
          program_id: 'prog-chase',
          program_matched_name: 'Chase Ultimate Rewards',
          confidence: 'alias',
        },
      ],
    })

    const formData = new FormData()
    formData.append('file', new File(['fake-pdf'], 'statement.pdf', { type: 'application/pdf' }))
    const request = {
      formData: async () => formData,
      headers: new Headers(),
    } as unknown as NextRequest

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.matched_count).toBe(1)
    expect(body.page_count).toBe(2)
    expect(body.candidates[0].program_id).toBe('prog-chase')
  })
})
