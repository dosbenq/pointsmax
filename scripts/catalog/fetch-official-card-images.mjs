import fs from 'node:fs'
import path from 'node:path'

const repoRoot = '/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax'
const catalogDir = path.join(repoRoot, 'Documentation', 'catalog')
const manifestPath = path.join(catalogDir, 'card-official-image-source-manifest.csv')
const outputDir = path.join(repoRoot, 'public', 'card-art', 'official')
const resultsPath = path.join(catalogDir, 'card-official-image-results.csv')
const REQUEST_TIMEOUT_MS = 15000

const args = process.argv.slice(2)
const limitArg = args.find((arg) => arg.startsWith('--limit='))
const regionArg = args.find((arg) => arg.startsWith('--region='))
const limit = limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '0', 10) : 0
const regionFilter = regionArg ? (regionArg.split('=')[1] ?? '').toUpperCase() : ''

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim()
  if (!text) return []
  const lines = text.split(/\r?\n/)
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

function toCsv(rows, headers) {
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => sanitizeCsv(row[header])).join(','))
  }
  return `${lines.join('\n')}\n`
}

function sanitizeCsv(value) {
  return String(value ?? '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toAbsoluteUrl(candidate, sourceUrl) {
  try {
    return new URL(candidate, sourceUrl).toString()
  } catch {
    return null
  }
}

function extFromUrl(url) {
  const match = url.match(/\.(png|jpg|jpeg|webp|svg)(?:$|[?#])/i)
  return match ? match[1].toLowerCase() : 'png'
}

function scoreCandidate(url, cardName, issuer) {
  const lower = url.toLowerCase()
  const cardTerms = cardName.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2)
  const issuerTerms = issuer.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2)
  let score = 0
  if (lower.includes('og:image')) score += 1
  if (lower.includes('card')) score += 2
  if (lower.includes('credit')) score += 1
  for (const term of cardTerms) {
    if (lower.includes(term)) score += 3
  }
  for (const term of issuerTerms) {
    if (lower.includes(term)) score += 1
  }
  if (lower.endsWith('.svg')) score += 1
  return score
}

function extractCandidates(html, sourceUrl) {
  const candidates = new Set()
  const srcMatches = [...html.matchAll(/(?:src|href|content)=["']([^"']+\.(?:png|jpg|jpeg|webp|svg)[^"']*)["']/gi)]
  for (const match of srcMatches) {
    const absolute = toAbsoluteUrl(match[1], sourceUrl)
    if (absolute) candidates.add(absolute)
  }
  return [...candidates]
}

async function downloadImage(url, destinationPath) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`image_download_failed:${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  fs.writeFileSync(destinationPath, Buffer.from(arrayBuffer))
}

async function fetchPage(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'user-agent': 'PointsMaxCatalogBot/1.0 (+https://pointsmax.example)',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) {
    throw new Error(`page_fetch_failed:${response.status}`)
  }
  return response.text()
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  let rows = parseCsv(manifestPath)
  const existingResults = fs.existsSync(resultsPath) ? parseCsv(resultsPath) : []
  const existingBySlug = new Map(existingResults.map((row) => [row.image_asset_slug, row]))
  if (regionFilter) {
    rows = rows.filter((row) => row.region === regionFilter)
  }
  if (limit > 0) {
    rows = rows.slice(0, limit)
  }

  const results = [...existingResults]

  for (const row of rows) {
    if (existingBySlug.has(row.image_asset_slug)) continue

    const result = {
      region: row.region,
      issuer: row.issuer,
      card_name: row.card_name,
      image_asset_slug: row.image_asset_slug,
      official_source_page: row.official_source_page,
      resolved_image_url: '',
      local_asset_path: '',
      fetch_status: 'pending',
      notes: '',
    }

    try {
      const html = await fetchPage(row.official_source_page)
      const candidates = extractCandidates(html, row.official_source_page)
        .map((url) => ({ url, score: scoreCandidate(url, row.card_name, row.issuer) }))
        .sort((a, b) => b.score - a.score)

      const winner = candidates[0]
      if (!winner || winner.score <= 0) {
        result.fetch_status = 'no_candidate_found'
        result.notes = 'No sufficiently plausible image asset found on source page'
        results.push(result)
        continue
      }

      const ext = extFromUrl(winner.url)
      const relativePath = `/card-art/official/${row.image_asset_slug}.${ext}`
      const absolutePath = path.join(outputDir, `${row.image_asset_slug}.${ext}`)
      await downloadImage(winner.url, absolutePath)

      result.resolved_image_url = winner.url
      result.local_asset_path = relativePath
      result.fetch_status = 'downloaded'
      result.notes = 'Downloaded from issuer-hosted asset candidate'
      results.push(result)
      existingBySlug.set(row.image_asset_slug, result)
    } catch (error) {
      result.fetch_status = 'failed'
      result.notes = String(error instanceof Error ? error.message : error)
      results.push(result)
      existingBySlug.set(row.image_asset_slug, result)
    }

    fs.writeFileSync(
      resultsPath,
      toCsv(results, [
        'region',
        'issuer',
        'card_name',
        'image_asset_slug',
        'official_source_page',
        'resolved_image_url',
        'local_asset_path',
        'fetch_status',
        'notes',
      ]),
    )
  }

  const summary = results.reduce(
    (acc, row) => {
      acc[row.fetch_status] = (acc[row.fetch_status] ?? 0) + 1
      return acc
    },
    {},
  )

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
