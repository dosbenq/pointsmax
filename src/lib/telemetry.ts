import { logInfo, logWarn, logError } from './logger'

export interface AiMetrics {
  operation: string
  model: string
  latency_ms: number
  is_fallback: boolean
  success: boolean
  tokens_prompt?: number
  tokens_completion?: number
  error?: string
  requestId?: string
}

/**
 * Tracks AI-specific metrics with structured logs.
 */
export function logAiMetric(metrics: AiMetrics) {
  const event = metrics.success ? 'ai_operation_complete' : 'ai_operation_failed'
  
  const payload = { ...metrics }
  
  if (metrics.success) {
    logInfo(event, payload)
  } else {
    logError(event, payload)
  }
  
  if (metrics.success && metrics.latency_ms > 10000) {
    logWarn('ai_slow_response', payload)
  }
  
  // Update internal metrics
  recordAiLatency(metrics.latency_ms)
}

// Global metrics store (ephemeral in serverless, but useful for warm containers)
export const internalMetrics = {
  ai_latencies: [] as number[],
  queue_latencies: [] as number[],
  errors: 0,
  last_ai_op: null as string | null,
  last_queue_op: null as string | null,
}

export function recordAiLatency(ms: number) {
  internalMetrics.ai_latencies.push(ms)
  if (internalMetrics.ai_latencies.length > 50) internalMetrics.ai_latencies.shift()
  internalMetrics.last_ai_op = new Date().toISOString()
}

export function recordQueueLatency(ms: number) {
  internalMetrics.queue_latencies.push(ms)
  if (internalMetrics.queue_latencies.length > 50) internalMetrics.queue_latencies.shift()
  internalMetrics.last_queue_op = new Date().toISOString()
}

export function incrementErrorCount() {
  internalMetrics.errors++
}

/**
 * Returns summary of metrics for health reporting
 */
export function getMetricsSummary() {
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
  const max = (arr: number[]) => arr.length ? Math.max(...arr) : 0
  
  return {
    ai: {
      avg_latency_ms: avg(internalMetrics.ai_latencies),
      max_latency_ms: max(internalMetrics.ai_latencies),
      last_operation: internalMetrics.last_ai_op,
      sample_count: internalMetrics.ai_latencies.length,
    },
    queue: {
      avg_processing_time_ms: avg(internalMetrics.queue_latencies),
      max_processing_time_ms: max(internalMetrics.queue_latencies),
      last_operation: internalMetrics.last_queue_op,
      sample_count: internalMetrics.queue_latencies.length,
    },
    errors: internalMetrics.errors,
  }
}
