import { beforeEach, describe, expect, it, vi } from 'vitest'
import { extractFromPdf } from './pdf-extractor'

const mockPdfParse = vi.fn()

vi.mock('pdf-parse', () => ({
  default: mockPdfParse,
}))

const programs = [
  { id: 'prog-chase', name: 'Chase Ultimate Rewards', slug: 'chase-ultimate-rewards' },
  { id: 'prog-amex', name: 'Amex Membership Rewards', slug: 'amex-membership-rewards' },
]

describe('extractFromPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns candidates when the PDF text contains balance lines', async () => {
    mockPdfParse.mockResolvedValue({
      text: 'Chase UR Points Balance: 45,234',
      numpages: 2,
    })

    const result = await extractFromPdf(Buffer.from('pdf-bytes'), programs)

    expect(result).toEqual({
      ok: true,
      page_count: 2,
      char_count: 31,
      candidates: [
        expect.objectContaining({
          balance: 45234,
          program_id: 'prog-chase',
        }),
      ],
    })
  })

  it('returns an error when pdf-parse throws', async () => {
    mockPdfParse.mockRejectedValue(new Error('corrupt pdf'))

    const result = await extractFromPdf(Buffer.from('bad-pdf'), programs)

    expect(result).toEqual({
      ok: false,
      error: 'Could not read PDF. Try a text export instead.',
    })
  })

  it('rejects oversized PDFs before parsing', async () => {
    const buffer = Buffer.alloc((5 * 1024 * 1024) + 1)

    const result = await extractFromPdf(buffer, programs)

    expect(result).toEqual({
      ok: false,
      error: 'File too large',
    })
    expect(mockPdfParse).not.toHaveBeenCalled()
  })
})
