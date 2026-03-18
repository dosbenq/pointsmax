import { parseStatementText, type TextParseCandidate } from './text-parser'
import type { ProgramAliasRow } from '@/lib/connectors/program-matcher'

type ProgramRow = {
  id: string
  name: string
  slug: string
}

type PdfParseModule = {
  default?: (buffer: Buffer, options?: Record<string, unknown>) => Promise<{ text?: string; numpages?: number }>
}

export type PdfExtractResult =
  | { ok: true; candidates: TextParseCandidate[]; page_count: number; char_count: number }
  | { ok: false; error: string }

const MAX_PDF_BYTES = 5 * 1024 * 1024
const MAX_PDF_PAGES = 20

export async function extractFromPdf(
  buffer: Buffer,
  programs: ProgramRow[],
  aliasRows: ProgramAliasRow[] = [],
): Promise<PdfExtractResult> {
  if (buffer.byteLength > MAX_PDF_BYTES) {
    return { ok: false, error: 'File too large' }
  }

  try {
    const pdfParseModule = (await import('pdf-parse')) as PdfParseModule
    const parsePdf = pdfParseModule.default
    if (typeof parsePdf !== 'function') {
      throw new Error('pdf-parse unavailable')
    }

    const parsed = await parsePdf(buffer, { max: MAX_PDF_PAGES })
    const text = typeof parsed.text === 'string' ? parsed.text : ''

    return {
      ok: true,
      candidates: parseStatementText(text, programs, aliasRows),
      page_count: Number(parsed.numpages ?? 0),
      char_count: text.length,
    }
  } catch {
    return {
      ok: false,
      error: 'Could not read PDF. Try a text export instead.',
    }
  }
}
