import { inngest } from '../client'

function getBaseAppUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

async function invokeCronPath(path: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const baseUrl = getBaseAppUrl()
  const secret = process.env.CRON_SECRET?.trim()
  if (!baseUrl || !secret) {
    return { ok: false, error: 'NEXT_PUBLIC_APP_URL or CRON_SECRET missing' }
  }

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      return { ok: false, status: res.status, error: await res.text().catch(() => 'Request failed') }
    }
    return { ok: true, status: res.status }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const scheduledBonusAlerts = inngest.createFunction(
  { id: 'scheduled-bonus-alerts', name: 'Scheduled: Bonus Alerts Dispatch' },
  { cron: '0 9 * * *' },
  async () => {
    return invokeCronPath('/api/cron/send-bonus-alerts')
  },
)

export const scheduledValuationsUpdate = inngest.createFunction(
  { id: 'scheduled-valuations-update', name: 'Scheduled: TPG Valuation Update' },
  { cron: '0 10 1 * *' },
  async () => {
    return invokeCronPath('/api/cron/update-valuations')
  },
)

export const scheduledYoutubeIngestion = inngest.createFunction(
  { id: 'scheduled-youtube-ingestion', name: 'Scheduled: YouTube Knowledge Ingest' },
  { cron: '0 11 * * 1' },
  async () => {
    return invokeCronPath('/api/cron/ingest-youtube-knowledge')
  },
)
