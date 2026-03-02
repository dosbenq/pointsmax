import { describe, expect, it, beforeEach } from 'vitest'
import { logAiMetric, getMetricsSummary, recordQueueLatency, incrementErrorCount, internalMetrics } from './telemetry'

describe('Telemetry', () => {
  beforeEach(() => {
    // Reset internal metrics before each test
    internalMetrics.ai_latencies = []
    internalMetrics.queue_latencies = []
    internalMetrics.errors = 0
    internalMetrics.last_ai_op = null
    internalMetrics.last_queue_op = null
  })

  it('records AI metrics correctly', () => {
    logAiMetric({
      operation: 'test-op',
      model: 'test-model',
      latency_ms: 100,
      is_fallback: false,
      success: true
    })

    const summary = getMetricsSummary()
    expect(summary.ai.sample_count).toBe(1)
    expect(summary.ai.avg_latency_ms).toBe(100)
    expect(summary.ai.last_operation).toBeTruthy()
  })

  it('records queue latency correctly', () => {
    recordQueueLatency(200)
    recordQueueLatency(400)

    const summary = getMetricsSummary()
    expect(summary.queue.sample_count).toBe(2)
    expect(summary.queue.avg_processing_time_ms).toBe(300)
    expect(summary.queue.max_processing_time_ms).toBe(400)
    expect(summary.queue.last_operation).toBeTruthy()
  })

  it('increments error count', () => {
    incrementErrorCount()
    incrementErrorCount()

    const summary = getMetricsSummary()
    expect(summary.errors).toBe(2)
  })

  it('limits the number of recorded latencies', () => {
    for (let i = 0; i < 100; i++) {
      recordQueueLatency(i)
    }

    const summary = getMetricsSummary()
    expect(summary.queue.sample_count).toBe(50) // Based on our limit in telemetry.ts
  })
})
