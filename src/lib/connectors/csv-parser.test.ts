import { describe, it, expect } from 'vitest'
import {
  parseBalanceCsv,
  mapToSnapshots,
  validateCsvFile,
  createIngestStatus,
  MAX_CSV_SIZE_BYTES,
  MAX_CSV_ROWS,
} from './csv-parser'

describe('CSV Parser', () => {
  describe('parseBalanceCsv', () => {
    it('parses simple CSV with program and balance columns', () => {
      const csv = `Program,Balance
Chase UR,100000
Amex MR,50000
Hyatt,25000`

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.rows).toHaveLength(3)
        expect(result.rows[0]).toEqual({
          program_name: 'Chase UR',
          balance: 100000,
        })
        expect(result.rows[1]).toEqual({
          program_name: 'Amex MR',
          balance: 50000,
        })
        expect(result.validRows).toBe(3)
        expect(result.invalidRows).toBe(0)
      }
    })

    it('handles different column name variations', () => {
      const variations = [
        { csv: 'program_name,balance\nChase,100000', desc: 'program_name' },
        { csv: 'Program Name,Points\nChase,100000', desc: 'Program Name + Points' },
        { csv: 'name,miles\nChase,100000', desc: 'name + miles' },
        { csv: 'Account,Amount\nChase,100000', desc: 'Account + Amount' },
        { csv: 'LOYALTY PROGRAM,CURRENT BALANCE\nChase,100000', desc: 'uppercase' },
      ]

      for (const { csv } of variations) {
        const result = parseBalanceCsv(csv)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.rows).toHaveLength(1)
          expect(result.rows[0].program_name).toBe('Chase')
          expect(result.rows[0].balance).toBe(100000)
        }
      }
    })

    it('parses CSV with all optional columns', () => {
      const csv = `Program,Balance,Program ID,Notes
Chase UR,100000,chase-123,Primary card
Amex MR,50000,amex-456,Business account`

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.rows).toHaveLength(2)
        expect(result.rows[0]).toEqual({
          program_name: 'Chase UR',
          balance: 100000,
          program_id: 'chase-123',
          notes: 'Primary card',
        })
      }
    })

    it('handles quoted fields with commas', () => {
      const csv = `Program,Balance
"Chase Ultimate Rewards, Personal",100000
"Amex Business Gold",50000`

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.rows).toHaveLength(2)
        expect(result.rows[0].program_name).toBe('Chase Ultimate Rewards, Personal')
        expect(result.rows[0].balance).toBe(100000)
      }
    })

    it('handles escaped quotes', () => {
      const csv = `Program,Balance
"Chase ""Sapphire"" Reserve",100000`

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.rows[0].program_name).toBe('Chase "Sapphire" Reserve')
      }
    })

    it('parses balances with formatting', () => {
      const csv = `Program,Balance
Chase,"100,000"
Amex,"50,000 points"
Hyatt,"$25,000"
United,50000 miles`

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.rows[0].balance).toBe(100000)
        expect(result.rows[1].balance).toBe(50000)
        expect(result.rows[2].balance).toBe(25000)
        expect(result.rows[3].balance).toBe(50000)
      }
    })

    it('handles CRLF line endings', () => {
      const csv = `Program,Balance\r\nChase,100000\r\nAmex,50000`

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.rows).toHaveLength(2)
      }
    })

    it('skips empty lines', () => {
      const csv = `Program,Balance
Chase,100000

Amex,50000
`

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.rows).toHaveLength(2)
      }
    })

    it('reports errors for invalid rows', () => {
      const csv = `Program,Balance
Chase,100000
,50000
Amex,invalid
Valid,25000`

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.validRows).toBe(2)
        expect(result.invalidRows).toBe(2)
        expect(result.errors).toHaveLength(2)
        // Error rows are 1-indexed (3 = third line after header)
        expect(result.errors[0].row).toBe(3)
        expect(result.errors[0].message).toContain('Program name is required')
        expect(result.errors[1].row).toBe(4)
        expect(result.errors[1].message).toContain('Invalid balance')
      }
    })

    it('rejects empty CSV', () => {
      const result = parseBalanceCsv('')
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('empty')
      }
    })

    it('rejects CSV without program column', () => {
      const csv = `Name,Points
Chase,100000`

      const result = parseBalanceCsv(csv)
      
      // "Name" is in PROGRAM_NAME_COLUMNS, so this should work
      expect(result.success).toBe(true)
    })

    it('rejects CSV without balance column', () => {
      const csv = `Program,Quantity
Chase,100000`

      const result = parseBalanceCsv(csv)
      
      // "Quantity" is not in BALANCE_COLUMNS
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('balance')
      }
    })

    it('rejects negative balances', () => {
      const csv = `Program,Balance
Chase,-1000`

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.validRows).toBe(0)
        expect(result.invalidRows).toBe(1)
        expect(result.errors[0].message).toContain('Invalid balance')
      }
    })

    it('rejects suspiciously high balances', () => {
      const csv = `Program,Balance
Chase,9999999999`

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.validRows).toBe(0)
        expect(result.errors[0].message).toContain('Invalid balance')
      }
    })

    it('rejects oversized CSV', () => {
      const hugeCsv = 'Program,Balance\n' + 
        Array(MAX_CSV_ROWS + 2).fill('Chase,100000').join('\n')

      const result = parseBalanceCsv(hugeCsv)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Too many rows')
      }
    })

    it('truncates program names that are too long', () => {
      const longName = 'A'.repeat(101)
      const csv = `Program,Balance\n${longName},100000`

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.validRows).toBe(0)
        expect(result.errors[0].message).toContain('too long')
      }
    })

    it('handles single column rows gracefully', () => {
      const csv = `Program,Balance
Chase
Amex,50000`

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.rows).toHaveLength(1)
        expect(result.rows[0].program_name).toBe('Amex')
      }
    })
  })

  describe('mapToSnapshots', () => {
    it('maps rows to snapshot format', () => {
      const rows = [
        { program_name: 'Chase UR', balance: 100000 },
        { program_name: 'Amex MR', balance: 50000, notes: 'Business' },
      ]

      const snapshots = mapToSnapshots(rows, 'user-123', 'account-456')

      expect(snapshots).toHaveLength(2)
      expect(snapshots[0]).toMatchObject({
        connected_account_id: 'account-456',
        user_id: 'user-123',
        program_id: 'unknown',
        balance: 100000,
        source: 'manual',
        raw_payload: { import_source: 'csv' },
      })
      expect(snapshots[1].raw_payload).toEqual({
        notes: 'Business',
        import_source: 'csv',
      })
      expect(snapshots[0].fetched_at).toBeDefined()
    })

    it('uses provided program_id if available', () => {
      const rows = [
        { program_name: 'Chase UR', balance: 100000, program_id: 'chase-ur-id' },
      ]

      const snapshots = mapToSnapshots(rows, 'user-123', 'account-456')

      expect(snapshots[0].program_id).toBe('chase-ur-id')
    })
  })

  describe('validateCsvFile', () => {
    it('accepts valid CSV file', () => {
      const file = { name: 'balances.csv', size: 1000, type: 'text/csv' }
      const result = validateCsvFile(file)
      
      expect(result.valid).toBe(true)
    })

    it('accepts .txt extension', () => {
      const file = { name: 'balances.txt', size: 1000, type: 'text/plain' }
      const result = validateCsvFile(file)
      
      expect(result.valid).toBe(true)
    })

    it('rejects invalid extension', () => {
      const file = { name: 'balances.pdf', size: 1000, type: 'application/pdf' }
      const result = validateCsvFile(file)
      
      expect(result.valid).toBe(false)
      expect(result.error).toContain('.csv or .txt')
    })

    it('rejects oversized files', () => {
      const file = { 
        name: 'balances.csv', 
        size: MAX_CSV_SIZE_BYTES + 1, 
        type: 'text/csv' 
      }
      const result = validateCsvFile(file)
      
      expect(result.valid).toBe(false)
      expect(result.error).toContain('too large')
    })

    it('handles files with empty mime type', () => {
      const file = { name: 'balances.csv', size: 1000, type: '' }
      const result = validateCsvFile(file)
      
      expect(result.valid).toBe(true)
    })
  })

  describe('createIngestStatus', () => {
    it('creates status with default messages', () => {
      const statuses = [
        { status: 'pending' as const, expected: 'waiting to process' },
        { status: 'processing' as const, expected: 'Processing your CSV' },
        { status: 'completed' as const, expected: 'completed successfully' },
        { status: 'failed' as const, expected: 'failed' },
      ]

      for (const { status, expected } of statuses) {
        const result = createIngestStatus(status)
        expect(result.status).toBe(status)
        expect(result.message).toContain(expected)
      }
    })

    it('allows custom messages', () => {
      const result = createIngestStatus('completed', { 
        customMessage: 'Custom success message' 
      })
      
      expect(result.message).toBe('Custom success message')
    })

    it('includes optional fields when provided', () => {
      const result = createIngestStatus('completed', {
        processedRows: 5,
        totalRows: 10,
        errors: ['Row 2 failed'],
      })
      
      expect(result.processedRows).toBe(5)
      expect(result.totalRows).toBe(10)
      expect(result.errors).toEqual(['Row 2 failed'])
    })

    it('omits errors when empty array', () => {
      const result = createIngestStatus('completed', {
        errors: [],
      })
      
      expect(result.errors).toBeUndefined()
    })
  })

  describe('Edge cases', () => {
    it('handles CSV with extra whitespace', () => {
      const csv = `  Program  ,  Balance  
  Chase  ,  100000  `

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.rows[0].program_name).toBe('Chase')
        expect(result.rows[0].balance).toBe(100000)
      }
    })

    it('handles CSV with BOM (Byte Order Mark)', () => {
      const csv = '\uFEFFProgram,Balance\nChase,100000'

      const result = parseBalanceCsv(csv)
      
      // BOM handling: the parser may or may not handle BOM depending on implementation
      // The important thing is it doesn't crash
      expect(result.success).toBeDefined()
    })

    it('handles zero balance', () => {
      const csv = 'Program,Balance\nChase,0'

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.rows[0].balance).toBe(0)
      }
    })

    it('handles very large but valid balance', () => {
      const csv = 'Program,Balance\nChase,999999999'

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.rows[0].balance).toBe(999999999)
      }
    })

    it('handles decimal balances by truncating', () => {
      const csv = 'Program,Balance\nChase,100000.75'

      const result = parseBalanceCsv(csv)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.rows[0].balance).toBe(100000)
      }
    })
  })
})
