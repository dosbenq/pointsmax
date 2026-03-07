// ============================================================
// POST /api/connectors/ingest/csv
// CSV balance import endpoint for non-OAuth ingestion
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseBalanceCsv, validateCsvFile, createIngestStatus, mapToSnapshots } from '@/lib/connectors/csv-parser'
import { logError, logInfo } from '@/lib/logger'
import type { IngestStatus } from '@/lib/connectors/csv-parser'

// Track ingestion jobs in memory (in production, use Redis/DB)
type IngestJob = {
  id: string
  userId: string
  status: IngestStatus['status']
  startedAt: string
  completedAt?: string
  result?: {
    totalRows: number
    validRows: number
    invalidRows: number
    errors: string[]
  }
}

const ingestJobs = new Map<string, IngestJob>()

export const __testing = {
  resetIngestJobs() {
    ingestJobs.clear()
  },
}

// Maximum concurrent jobs per user
const MAX_CONCURRENT_JOBS = 3

// ─────────────────────────────────────────────
// POST /api/connectors/ingest/csv
// Upload and process a CSV file of balances
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()

  // Auth check
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const userId = user.id

  try {
    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const connectedAccountId = formData.get('connectedAccountId') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file
    const fileValidation = validateCsvFile(file)
    if (!fileValidation.valid) {
      return NextResponse.json(
        { error: fileValidation.error },
        { status: 400 }
      )
    }

    // Check concurrent job limit
    const userJobs = Array.from(ingestJobs.values()).filter(j => 
      j.userId === userId && j.status === 'processing'
    )
    if (userJobs.length >= MAX_CONCURRENT_JOBS) {
      return NextResponse.json(
        { error: 'Too many concurrent imports. Please wait for existing jobs to complete.' },
        { status: 429 }
      )
    }

    // Create job record
    const jobId = crypto.randomUUID()
    const job: IngestJob = {
      id: jobId,
      userId,
      status: 'processing',
      startedAt: new Date().toISOString(),
    }
    ingestJobs.set(jobId, job)

    logInfo('csv_ingest_started', {
      requestId,
      jobId,
      userId,
      fileName: file.name,
      fileSize: file.size,
    })

    // Read and parse CSV
    const csvContent = await file.text()
    const parseResult = parseBalanceCsv(csvContent)

    if (!parseResult.success) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      job.result = {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: [parseResult.error],
      }

      logError('csv_ingest_parse_failed', {
        requestId,
        jobId,
        error: parseResult.error,
      })

      return NextResponse.json(
        {
          error: parseResult.error,
          jobId,
          status: createIngestStatus('failed'),
        },
        { status: 422 }
      )
    }

    // If no valid rows, fail early
    if (parseResult.validRows === 0) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      job.result = {
        totalRows: parseResult.totalRows,
        validRows: 0,
        invalidRows: parseResult.invalidRows,
        errors: parseResult.errors.map(e => `Row ${e.row}: ${e.message}`),
      }

      return NextResponse.json(
        {
          error: 'No valid rows found in CSV',
          jobId,
          status: createIngestStatus('failed', {
            customMessage: `Import failed: No valid rows found. ${parseResult.errors.length} errors detected.`,
            errors: parseResult.errors.map(e => `Row ${e.row}: ${e.message}`),
          }),
          details: parseResult.errors,
        },
        { status: 422 }
      )
    }

    // Map to snapshots
    const targetAccountId = connectedAccountId || 'manual-import'
    const snapshots = mapToSnapshots(parseResult.rows, userId, targetAccountId)

    // Insert snapshots into database
    const { error: insertError } = await supabase
      .from('balance_snapshots')
      .insert(snapshots)

    if (insertError) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      job.result = {
        totalRows: parseResult.totalRows,
        validRows: 0,
        invalidRows: parseResult.validRows,
        errors: [insertError.message],
      }

      logError('csv_ingest_db_failed', {
        requestId,
        jobId,
        error: insertError.message,
      })

      return NextResponse.json(
        {
          error: 'Failed to save balances to database',
          jobId,
          status: createIngestStatus('failed'),
        },
        { status: 500 }
      )
    }

    // Update job as completed
    job.status = 'completed'
    job.completedAt = new Date().toISOString()
    job.result = {
      totalRows: parseResult.totalRows,
      validRows: parseResult.validRows,
      invalidRows: parseResult.invalidRows,
      errors: parseResult.errors.map(e => `Row ${e.row}: ${e.message}`),
    }

    const duration = Date.now() - startedAt

    logInfo('csv_ingest_completed', {
      requestId,
      jobId,
      userId,
      durationMs: duration,
      totalRows: parseResult.totalRows,
      validRows: parseResult.validRows,
      invalidRows: parseResult.invalidRows,
    })

    // Return success response
    return NextResponse.json({
      jobId,
      status: createIngestStatus('completed', {
        processedRows: parseResult.validRows,
        totalRows: parseResult.totalRows,
        errors: parseResult.errors.length > 0 
          ? parseResult.errors.map(e => `Row ${e.row}: ${e.message}`)
          : undefined,
      }),
      summary: {
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        invalidRows: parseResult.invalidRows,
        importedBalances: snapshots.length,
      },
      warnings: parseResult.errors.length > 0 ? parseResult.errors : undefined,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logError('csv_ingest_unexpected_error', {
      requestId,
      userId,
      error: errorMessage,
    })

    return NextResponse.json(
      {
        error: 'Import failed due to an unexpected error',
        status: createIngestStatus('failed'),
      },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────
// GET /api/connectors/ingest/csv?jobId=xxx
// Check status of an ingestion job
// ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')

  // Auth check
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  if (!jobId) {
    // Return all jobs for user
    const userJobs = Array.from(ingestJobs.values())
      .filter(j => j.userId === user.id)
      .map(j => ({
        jobId: j.id,
        status: j.status,
        startedAt: j.startedAt,
        completedAt: j.completedAt,
        ...(j.result && {
          summary: {
            totalRows: j.result.totalRows,
            validRows: j.result.validRows,
            invalidRows: j.result.invalidRows,
          },
        }),
      }))

    return NextResponse.json({
      jobs: userJobs,
    })
  }

  // Return specific job
  const job = ingestJobs.get(jobId)

  if (!job || job.userId !== user.id) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    jobId: job.id,
    status: createIngestStatus(job.status, {
      processedRows: job.result?.validRows,
      totalRows: job.result?.totalRows,
      errors: job.result?.errors,
    }),
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    ...(job.result && {
      summary: {
        totalRows: job.result.totalRows,
        validRows: job.result.validRows,
        invalidRows: job.result.invalidRows,
      },
    }),
  })
}
