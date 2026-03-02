import { inngest } from '@/lib/inngest/client'
import { createAdminClient } from '@/lib/supabase'
import { logInfo, logError } from '@/lib/logger'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { logAiMetric } from '@/lib/telemetry'

const GENAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Sources for India credit card valuations
const SOURCES = [
  'https://www.cardexpert.in/best-credit-cards/',
  'https://www.cardexpert.in/hdfc-infinia-credit-card/',
  'https://www.cardexpert.in/axis-magnus-credit-card/',
]

// India program mapping
const INDIA_PROGRAMS: Record<string, { slug: string; name: string }> = {
  'hdfc': { slug: 'hdfc-millennia', name: 'HDFC Millennia Rewards' },
  'hdfc infinia': { slug: 'hdfc-millennia', name: 'HDFC Millennia Rewards' },
  'hdfc regalia': { slug: 'hdfc-millennia', name: 'HDFC Millennia Rewards' },
  'axis': { slug: 'axis-edge', name: 'Axis EDGE Rewards' },
  'axis edge': { slug: 'axis-edge', name: 'Axis EDGE Rewards' },
  'axis atlas': { slug: 'axis-edge', name: 'Axis EDGE Rewards' },
  'axis magnus': { slug: 'axis-edge', name: 'Axis EDGE Rewards' },
  'amex india': { slug: 'amex-india-mr', name: 'Amex MR India' },
  'american express india': { slug: 'amex-india-mr', name: 'Amex MR India' },
  'air india': { slug: 'air-india', name: 'Air India Maharaja Club' },
  'air india maharaja': { slug: 'air-india', name: 'Air India Maharaja Club' },
  'indigo': { slug: 'indigo-6e', name: 'IndiGo 6E Rewards' },
  'taj': { slug: 'taj-innercircle', name: 'Taj InnerCircle' },
  'taj innercircle': { slug: 'taj-innercircle', name: 'Taj InnerCircle' },
}

type ScrapedValuation = {
  program_name: string
  cpp_inr: number
  source_quote: string
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PointsMaxBot/1.0)',
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.text()
  } catch (error) {
    logError('india_scraper_fetch_failed', { url, error: String(error) })
    return ''
  }
}

async function extractValuationsWithGemini(html: string): Promise<ScrapedValuation[]> {
  const startedAt = Date.now()
  const model = GENAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  
  const prompt = `Extract credit card reward point valuations from this HTML content.
...
HTML content to analyze:
${html.slice(0, 150000)}`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      logAiMetric({
        operation: 'india_scraper_extract',
        model: 'gemini-1.5-flash',
        latency_ms: Date.now() - startedAt,
        is_fallback: false,
        success: true,
      })
      return []
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed)) {
      logAiMetric({
        operation: 'india_scraper_extract',
        model: 'gemini-1.5-flash',
        latency_ms: Date.now() - startedAt,
        is_fallback: false,
        success: true,
      })
      return []
    }
    
    logAiMetric({
      operation: 'india_scraper_extract',
      model: 'gemini-1.5-flash',
      latency_ms: Date.now() - startedAt,
      is_fallback: false,
      success: true,
    })

    return parsed.filter((v): v is ScrapedValuation => 
      typeof v.program_name === 'string' &&
      typeof v.cpp_inr === 'number' &&
      typeof v.source_quote === 'string'
    )
  } catch (error) {
    logAiMetric({
      operation: 'india_scraper_extract',
      model: 'gemini-1.5-flash',
      latency_ms: Date.now() - startedAt,
      is_fallback: false,
      success: false,
      error: String(error),
    })
    return []
  }
}

function mapToProgramSlug(programName: string): string | null {
  const normalized = programName.toLowerCase().trim()
  
  for (const [key, value] of Object.entries(INDIA_PROGRAMS)) {
    if (normalized.includes(key)) {
      return value.slug
    }
  }
  
  return null
}

export const indiaValuationsScraper = inngest.createFunction(
  { id: 'india-valuations-scraper' },
  { cron: '0 11 1 * *' }, // 1st of each month at 11am UTC (1 hour after TPG scraper)
  async ({ event, step }) => {
    const jobId = event.id || `india-scrape-${Date.now()}`
    logInfo('india_valuations_scraper_started', { jobId })

    const db = createAdminClient()
    const allValuations: ScrapedValuation[] = []
    const unmappedPrograms: string[] = []

    // Fetch and extract from each source
    for (const url of SOURCES) {
      await step.run(`fetch-${url}`, async () => {
        const html = await fetchPageContent(url)
        if (html) {
          const valuations = await extractValuationsWithGemini(html)
          allValuations.push(...valuations)
        }
      })
    }

    // Get program IDs from database
    const { data: programs } = await db
      .from('programs')
      .select('id, slug')
      .eq('geography', 'IN')

    const programIdBySlug = new Map(programs?.map(p => [p.slug, p.id]) || [])
    
    // Process and store valuations
    const processedSlugs = new Set<string>()
    const inserts: {
      program_id: string
      cpp_cents: number
      source: string
      notes: string
      effective_date: string
    }[] = []

    for (const valuation of allValuations) {
      const slug = mapToProgramSlug(valuation.program_name)
      
      if (!slug) {
        unmappedPrograms.push(valuation.program_name)
        continue
      }
      
      if (processedSlugs.has(slug)) {
        continue // Skip duplicates
      }
      
      const programId = programIdBySlug.get(slug)
      if (!programId) {
        unmappedPrograms.push(`${valuation.program_name} (no program ID)`)
        continue
      }

      // Convert INR to paise (multiply by 100)
      const cppPaise = Math.round(valuation.cpp_inr * 100)
      
      inserts.push({
        program_id: programId as string,
        cpp_cents: cppPaise,
        source: 'india-scraper' as const,
        notes: `Auto-detected (unverified): ${valuation.source_quote.slice(0, 180)}`,
        effective_date: new Date().toISOString().slice(0, 10),
      })
      
      processedSlugs.add(slug)
    }

    // Check for significant changes (>20% difference)
    const alerts: string[] = []
    if (inserts.length > 0) {
      const { data: currentValuations } = await db
        .from('latest_valuations')
        .select('program_id, cpp_cents, slug')
        .in('program_id', inserts.map(i => i.program_id)) as { 
          data: Array<{ program_id: string; cpp_cents: number; slug: string }> | null 
        }

      for (const insert of inserts) {
        const current = currentValuations?.find(v => v.program_id === insert.program_id)
        if (current) {
          const change = Math.abs(insert.cpp_cents - current.cpp_cents) / current.cpp_cents
          if (change > 0.20) {
            alerts.push(`${current.slug}: ₹${(current.cpp_cents / 100).toFixed(2)} → ₹${(insert.cpp_cents / 100).toFixed(2)} (${(change * 100).toFixed(0)}% change)`)
          }
        }
      }

      // Insert new valuations
      const { error: insertError } = await db
        .from('valuations')
        .insert(inserts)

      if (insertError) {
        logError('india_valuations_insert_failed', { 
          jobId, 
          error: insertError.message,
          count: inserts.length 
        })
        return { ok: false, error: insertError.message }
      }
    }

    // Send alert if significant changes detected
    if (alerts.length > 0) {
      await step.run('send-admin-alert', async () => {
        // In production, this would send an email via Resend
        logInfo('india_valuations_significant_change', {
          jobId,
          alerts,
          count: alerts.length,
        })
      })
    }

    logInfo('india_valuations_scraper_complete', {
      jobId,
      sourcesScraped: SOURCES.length,
      valuationsFound: allValuations.length,
      inserted: inserts.length,
      unmapped: unmappedPrograms.length,
      significantChanges: alerts.length,
    })

    return {
      ok: true,
      inserted: inserts.length,
      unmapped: unmappedPrograms,
      significant_changes: alerts,
    }
  }
)
