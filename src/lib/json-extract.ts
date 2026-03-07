export function extractJsonObject(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    const candidate = fenced[1].trim()
    try {
      JSON.parse(candidate)
      return candidate
    } catch {
      // fall through to balanced scanning
    }
  }

  let start = -1
  let depth = 0
  let inString = false
  let escaping = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (escaping) {
      escaping = false
      continue
    }

    if (char === '\\' && inString) {
      escaping = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') {
      if (depth === 0) start = index
      depth += 1
      continue
    }

    if (char === '}') {
      if (depth === 0 || start === -1) continue
      depth -= 1
      if (depth === 0) {
        const candidate = text.slice(start, index + 1)
        try {
          JSON.parse(candidate)
          return candidate
        } catch {
          start = -1
        }
      }
    }
  }

  return null
}
