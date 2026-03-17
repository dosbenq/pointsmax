type IngestJob = {
  id: string
  userId: string
  status: 'processing' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  result?: {
    totalRows: number
    validRows: number
    invalidRows: number
    errors: string[]
  }
}

export const ingestJobs = new Map<string, IngestJob>()

export function resetIngestJobs() {
  ingestJobs.clear()
}

export type { IngestJob }
