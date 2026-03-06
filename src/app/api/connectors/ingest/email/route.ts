// ============================================================
// POST /api/connectors/ingest/email
// Statement/email ingestion endpoint — BASELINE PLACEHOLDER
// 
// This endpoint provides a clear status for the planned email
// statement ingestion feature. For now, it returns a helpful
// message directing users to the CSV import option.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logInfo } from '@/lib/logger'
import type { IngestStatus } from '@/lib/connectors/csv-parser'

// Feature flag for email ingestion
const EMAIL_INGESTION_ENABLED = process.env.ENABLE_EMAIL_INGESTION === 'true'

// Feature roadmap info
const FEATURE_ROADMAP = {
  status: 'planned' as const,
  estimatedRelease: 'Q2 2026',
  supportedProviders: [
    'amex',
    'chase', 
    'citi',
    'capital_one',
    'bilt',
  ] as string[],
  description: 'Automatic parsing of monthly statement emails to extract point balances',
}

type EmailIngestRequest = {
  action: 'register_interest' | 'check_status'
  emailDomain?: string
  provider?: string
}

// ─────────────────────────────────────────────
// POST /api/connectors/ingest/email
// Submit email for processing or register interest
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()

  // Auth check
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  let body: EmailIngestRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  logInfo('email_ingest_request', {
    requestId,
    userId: user.id,
    action: body.action,
  })

  // Feature not yet enabled - return placeholder status
  if (!EMAIL_INGESTION_ENABLED) {
    if (body.action === 'register_interest') {
      // Store interest for future feature rollout
      const { error } = await supabase
        .from('user_feature_interests')
        .upsert({
          user_id: user.id,
          feature: 'email_statement_ingest',
          metadata: {
            email_domain: body.emailDomain,
            preferred_provider: body.provider,
            registered_at: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,feature',
        })

      if (error) {
        logInfo('email_ingest_interest_failed', {
          requestId,
          userId: user.id,
          error: error.message,
        })
        // Non-blocking - continue to return helpful response
      }

      return NextResponse.json({
        status: createIngestStatus('pending', {
          customMessage: "Thanks for your interest! We'll notify you when email statement import is available.",
        }),
        feature: FEATURE_ROADMAP,
        alternative: {
          method: 'csv_import',
          endpoint: '/api/connectors/ingest/csv',
          description: 'Import your balances via CSV export from your bank/loyalty program',
        },
      })
    }

    // Default status check response
    return NextResponse.json({
      status: createIngestStatus('pending', {
        customMessage: 'Email statement import is coming soon! Use CSV import for now.',
      }),
      feature: FEATURE_ROADMAP,
      alternative: {
        method: 'csv_import',
        endpoint: '/api/connectors/ingest/csv',
        description: 'Export your balances as CSV from your bank/loyalty program and upload them',
      },
    })
  }

  // If feature is enabled (future implementation)
  return NextResponse.json({
    status: createIngestStatus('processing', {
      customMessage: 'Email processing is not yet fully implemented.',
    }),
    feature: {
      ...FEATURE_ROADMAP,
      status: 'beta' as const,
    },
  })
}

// ─────────────────────────────────────────────
// GET /api/connectors/ingest/email
// Check email ingestion capability status
// ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth check
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const includeGuide = searchParams.get('guide') === 'true'

  const status: IngestStatus = EMAIL_INGESTION_ENABLED
    ? createIngestStatus('processing', {
        customMessage: 'Email ingestion is in beta. Processing capabilities are limited.',
      })
    : createIngestStatus('pending', {
        customMessage: 'Email statement import is planned for a future release.',
      })

  const response: Record<string, unknown> = {
    enabled: EMAIL_INGESTION_ENABLED,
    status,
    feature: FEATURE_ROADMAP,
  }

  if (includeGuide) {
    response.guide = {
      title: 'How to export your balances for CSV import',
      steps: [
        {
          provider: 'Chase',
          instructions: 'Log in → Ultimate Rewards → See all balances → Export',
        },
        {
          provider: 'American Express',
          instructions: 'Log in → Membership Rewards → Points Summary → Download',
        },
        {
          provider: 'Citi',
          instructions: 'Log in → ThankYou Rewards → Account → Export Activity',
        },
        {
          provider: 'Generic',
          instructions: 'Log in to your loyalty program → Find points/miles balance → Copy to a CSV file with columns: Program, Balance',
        },
      ],
      csvFormat: {
        requiredColumns: ['Program', 'Balance'],
        optionalColumns: ['Program ID', 'Notes'],
        example: `Program,Balance,Notes
Chase UR,100000,Personal card
Amex MR,50000,Business account`,
      },
    }
    response.alternative = {
      method: 'csv_import',
      endpoint: '/api/connectors/ingest/csv',
      documentation: 'POST a multipart/form-data with a CSV file to import balances immediately',
    }
  }

  return NextResponse.json(response)
}

// Helper to create consistent status objects
function createIngestStatus(
  status: IngestStatus['status'],
  options: { customMessage?: string } = {},
): IngestStatus {
  const messages: Record<IngestStatus['status'], string> = {
    pending: 'Email ingestion is not yet available.',
    processing: 'Email ingestion capability is being prepared.',
    completed: 'Email ingestion completed.',
    failed: 'Email ingestion is not available.',
  }

  return {
    status,
    message: options.customMessage || messages[status],
  }
}
