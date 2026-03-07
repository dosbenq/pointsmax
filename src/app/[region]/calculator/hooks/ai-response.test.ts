import { describe, expect, it } from 'vitest'
import { extractJsonObject } from './ai-response'

describe('extractJsonObject', () => {
  it('extracts plain JSON objects', () => {
    expect(extractJsonObject('{"type":"recommendation","headline":"Test"}')).toBe('{"type":"recommendation","headline":"Test"}')
  })

  it('extracts fenced JSON blocks', () => {
    const payload = 'Here you go:\n```json\n{"type":"clarifying","message":"Test"}\n```'
    expect(extractJsonObject(payload)).toBe('{"type":"clarifying","message":"Test"}')
  })

  it('extracts the first valid balanced JSON object from mixed text', () => {
    const payload = 'Before text {"type":"recommendation","headline":"A","nested":{"ok":true}} after text'
    expect(extractJsonObject(payload)).toBe('{"type":"recommendation","headline":"A","nested":{"ok":true}}')
  })

  it('returns null when no valid object exists', () => {
    expect(extractJsonObject('No JSON here')).toBeNull()
  })
})
