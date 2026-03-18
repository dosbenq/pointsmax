// ============================================================
// PointsMax — CSV Balance Import Parser
//
// Parses CSV files containing loyalty program balances and maps
// them to the normalized snapshot model. Supports common export
// formats from major banks and loyalty programs.
// ============================================================

import type { BalanceSnapshotSource } from '@/types/connectors'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type CsvRow = {
  program_name: string
  balance: number
  program_id?: string // Optional - if user knows the internal ID
  notes?: string
}

export type CsvParseResult = {
  success: true
  rows: CsvRow[]
  totalRows: number
  validRows: number
  invalidRows: number
  errors: CsvParseError[]
} | {
  success: false
  error: string
  rows: never[]
}

export type CsvParseError = {
  row: number
  column?: string
  value: string
  message: string
}

export type IngestStatus = {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message: string
  processedRows?: number
  totalRows?: number
  errors?: string[]
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

/** Maximum CSV file size (1MB) */
export const MAX_CSV_SIZE_BYTES = 1 * 1024 * 1024

/** Maximum number of rows to process */
export const MAX_CSV_ROWS = 1000

/** Supported column name variations for program name */
const PROGRAM_NAME_COLUMNS = [
  'program',
  'program_name',
  'program name',
  'name',
  'loyalty program',
  'account',
  'account name',
  'issuer',
  'bank',
  'partner',
]

/** Supported column name variations for balance */
const BALANCE_COLUMNS = [
  'balance',
  'points',
  'miles',
  'amount',
  'value',
  'current balance',
  'available',
  'total',
  'points balance',
  'mileage',
]

/** Supported column name variations for program ID */
const PROGRAM_ID_COLUMNS = [
  'program_id',
  'program id',
  'id',
  'program code',
  'code',
]

/** Supported column name variations for notes */
const NOTES_COLUMNS = [
  'notes',
  'note',
  'comments',
  'comment',
  'description',
  'memo',
]

// ─────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/[_-]/g, ' ')
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map(normalizeColumnName)
  for (const candidate of candidates) {
    const normalized = normalizeColumnName(candidate)
    const index = normalizedHeaders.indexOf(normalized)
    if (index !== -1) return index
  }
  return -1
}

function parseBalance(value: string): number | null {
  if (!value || !value.trim()) return null
  
  // Remove common formatting: commas, spaces, currency symbols, "points", "miles", etc.
  const cleaned = value
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .replace(/points?/gi, '')
    .replace(/miles?/gi, '')
    .replace(/[$€£₹]/g, '')
    .trim()
  
  // After removing currency symbols and formatting, we should have just digits
  // Handle cases like "$100,000" which becomes "100000"
  // BUT preserve negative sign for validation
  const numericOnly = cleaned.replace(/[^0-9.-]/g, '')
  
  // Check for negative sign before parsing
  if (numericOnly.startsWith('-')) {
    return null // Negative balances not allowed
  }
  
  const parsed = Number.parseFloat(numericOnly)
  if (!Number.isFinite(parsed)) return null
  if (parsed < 0) return null // No negative balances
  if (parsed > 1_000_000_000) return null // Suspiciously high
  
  return Math.floor(parsed)
}

function validateRow(
  row: string[],
  rowIndex: number,
  programCol: number,
  balanceCol: number,
  programIdCol: number,
  notesCol: number,
): { valid: false; error: CsvParseError } | { valid: true; data: CsvRow } {
  const programName = row[programCol]?.trim() || ''
  const balanceStr = row[balanceCol]?.trim() || ''
  const programId = programIdCol >= 0 ? row[programIdCol]?.trim() : undefined
  const notes = notesCol >= 0 ? row[notesCol]?.trim() : undefined
  
  // Validate program name
  if (!programName) {
    return {
      valid: false,
      error: {
        row: rowIndex + 1,
        column: 'program_name',
        value: row[programCol] || '',
        message: 'Program name is required',
      },
    }
  }
  
  if (programName.length > 100) {
    return {
      valid: false,
      error: {
        row: rowIndex + 1,
        column: 'program_name',
        value: programName,
        message: 'Program name too long (max 100 characters)',
      },
    }
  }
  
  // Validate balance
  const balance = parseBalance(balanceStr)
  if (balance === null) {
    return {
      valid: false,
      error: {
        row: rowIndex + 1,
        column: 'balance',
        value: balanceStr,
        message: 'Invalid balance - must be a positive number',
      },
    }
  }
  
  return {
    valid: true,
    data: {
      program_name: programName,
      balance,
      ...(programId && { program_id: programId }),
      ...(notes && { notes }),
    },
  }
}

// ─────────────────────────────────────────────
// PARSING
// ─────────────────────────────────────────────

/**
 * Parse a CSV string into structured balance rows.
 * 
 * Supports flexible column naming - will auto-detect:
 * - Program name columns: program, name, account, issuer, etc.
 * - Balance columns: balance, points, miles, amount, etc.
 * - Optional: program_id, notes
 * 
 * @param csvContent Raw CSV string content
 * @returns Parse result with rows or error details
 */
export function parseBalanceCsv(csvContent: string): CsvParseResult {
  // Basic validation
  if (!csvContent || !csvContent.trim()) {
    return { success: false, error: 'CSV content is empty', rows: [] }
  }
  
  if (csvContent.length > MAX_CSV_SIZE_BYTES) {
    return { 
      success: false, 
      error: `CSV file too large (max ${MAX_CSV_SIZE_BYTES / 1024}KB)`, 
      rows: [] 
    }
  }
  
  // Split into lines and handle different line endings
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim())
  
  if (lines.length === 0) {
    return { success: false, error: 'CSV has no data rows', rows: [] }
  }
  
  if (lines.length > MAX_CSV_ROWS + 1) { // +1 for header
    return { 
      success: false, 
      error: `Too many rows (max ${MAX_CSV_ROWS} data rows)`, 
      rows: [] 
    }
  }
  
  // Parse header row
  const headerLine = lines[0]
  const headers = parseCsvLine(headerLine)
  
  if (headers.length === 0) {
    return { success: false, error: 'Could not parse CSV headers', rows: [] }
  }
  
  // Find required columns
  const programCol = findColumnIndex(headers, PROGRAM_NAME_COLUMNS)
  const balanceCol = findColumnIndex(headers, BALANCE_COLUMNS)
  const programIdCol = findColumnIndex(headers, PROGRAM_ID_COLUMNS)
  const notesCol = findColumnIndex(headers, NOTES_COLUMNS)
  
  if (programCol === -1) {
    return { 
      success: false, 
      error: `Could not find program name column. Expected one of: ${PROGRAM_NAME_COLUMNS.join(', ')}`, 
      rows: [] 
    }
  }
  
  if (balanceCol === -1) {
    return { 
      success: false, 
      error: `Could not find balance column. Expected one of: ${BALANCE_COLUMNS.join(', ')}`, 
      rows: [] 
    }
  }
  
  // Parse data rows
  const rows: CsvRow[] = []
  const errors: CsvParseError[] = []
  let validRows = 0
  let invalidRows = 0
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue // Skip empty lines
    
    const cells = parseCsvLine(line)
    if (cells.length === 0) continue
    
    // Pad cells array if needed
    while (cells.length < headers.length) {
      cells.push('')
    }
    
    const result = validateRow(
      cells,
      i,
      programCol,
      balanceCol,
      programIdCol,
      notesCol,
    )
    
    if (result.valid) {
      rows.push(result.data)
      validRows++
    } else {
      errors.push(result.error)
      invalidRows++
    }
  }
  
  return {
    success: true,
    rows,
    totalRows: validRows + invalidRows,
    validRows,
    invalidRows,
    errors,
  }
}

/**
 * Parse a single CSV line respecting quoted fields.
 * Basic CSV parser - handles quoted fields and escaped quotes.
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of cell
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  // Don't forget the last cell
  cells.push(current.trim())
  
  return cells
}

// ─────────────────────────────────────────────
// SNAPSHOT MAPPING
// ─────────────────────────────────────────────

/**
 * Maps parsed CSV rows to the balance snapshot model.
 * 
 * Note: This creates manual-entry snapshots (not connector-fetched).
 * The user_id and connected_account_id must be provided by the caller.
 */
export function mapToSnapshots(
  rows: CsvRow[],
  userId: string,
  connectedAccountId: string,
): Array<{
  connected_account_id: string
  user_id: string
  program_id: string
  balance: number
  source: BalanceSnapshotSource
  fetched_at: string
  raw_payload: Record<string, unknown> | null
}> {
  const now = new Date().toISOString()

  return rows
    .filter((row): row is CsvRow & { program_id: string } => typeof row.program_id === 'string' && row.program_id.length > 0)
    .map(row => ({
    connected_account_id: connectedAccountId,
    user_id: userId,
    program_id: row.program_id,
    balance: row.balance,
    source: 'manual' as BalanceSnapshotSource,
    fetched_at: now,
    raw_payload: row.notes ? { notes: row.notes, import_source: 'csv' } : { import_source: 'csv' },
    }))
}

// ─────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────

/**
 * Validates file type and size before parsing.
 */
export function validateCsvFile(
  file: File | { name: string; size: number; type: string },
): { valid: true } | { valid: false; error: string } {
  // Check file extension
  const validExtensions = ['.csv', '.txt']
  const hasValidExtension = validExtensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  )
  
  if (!hasValidExtension) {
    return { valid: false, error: 'File must be a .csv or .txt file' }
  }
  
  // Check size
  if (file.size > MAX_CSV_SIZE_BYTES) {
    return { 
      valid: false, 
      error: `File too large (${(file.size / 1024).toFixed(1)}KB). Max size: ${MAX_CSV_SIZE_BYTES / 1024}KB` 
    }
  }
  
  // Check MIME type (if provided)
  if (file.type && !['text/csv', 'text/plain', 'application/vnd.ms-excel', ''].includes(file.type)) {
    return { valid: false, error: `Invalid file type: ${file.type}` }
  }
  
  return { valid: true }
}

/**
 * Creates a user-visible ingest status object.
 */
export function createIngestStatus(
  status: IngestStatus['status'],
  options: {
    processedRows?: number
    totalRows?: number
    errors?: string[]
    customMessage?: string
  } = {},
): IngestStatus {
  const messages: Record<IngestStatus['status'], string> = {
    pending: 'Import request received, waiting to process...',
    processing: 'Processing your CSV file...',
    completed: 'Import completed successfully!',
    failed: 'Import failed. Please check your file and try again.',
  }
  
  return {
    status,
    message: options.customMessage || messages[status],
    ...(options.processedRows !== undefined && { processedRows: options.processedRows }),
    ...(options.totalRows !== undefined && { totalRows: options.totalRows }),
    ...(options.errors?.length && { errors: options.errors }),
  }
}
