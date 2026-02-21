import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import { reportErrorToMonitoring } from '@/lib/monitoring'

type LogLevel = 'info' | 'warn' | 'error'

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return JSON.stringify({ message: 'Failed to serialize log payload' })
  }
}

function writeLog(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  }
  const line = safeJson(payload)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
  if (level === 'error') {
    reportErrorToMonitoring(event, data)
  }
}

export function getRequestId(req: NextRequest): string {
  return (
    req.headers.get('x-request-id') ??
    req.headers.get('x-vercel-id') ??
    crypto.randomUUID()
  )
}

export function logInfo(event: string, data?: Record<string, unknown>) {
  writeLog('info', event, data)
}

export function logWarn(event: string, data?: Record<string, unknown>) {
  writeLog('warn', event, data)
}

export function logError(event: string, data?: Record<string, unknown>) {
  writeLog('error', event, data)
}
