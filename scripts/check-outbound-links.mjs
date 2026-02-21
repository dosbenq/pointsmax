import fs from 'node:fs/promises'

const SOURCE_FILES = [
  'src/app/api/ai/recommend/route.ts',
  'src/app/api/trip-builder/route.ts',
  'src/lib/award-search/deep-links.ts',
]

const SOFT_BLOCK_STATUSES = new Set([401, 403, 405, 429, 503])
const URL_RE = /https?:\/\/[^\s'"`)\]]+/g

async function collectUrls() {
  const urls = new Map()

  for (const file of SOURCE_FILES) {
    const text = await fs.readFile(file, 'utf8')
    const matches = text.match(URL_RE) ?? []
    for (const raw of matches) {
      if (raw.includes('${')) continue
      if (!urls.has(raw)) urls.set(raw, new Set())
      urls.get(raw).add(file)
    }
  }

  return urls
}

async function checkUrl(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    })

    const status = response.status
    const finalUrl = response.url

    if (status >= 200 && status < 400) {
      return { state: 'ok', status, finalUrl }
    }

    if (SOFT_BLOCK_STATUSES.has(status)) {
      return { state: 'soft', status, finalUrl }
    }

    return { state: 'hard', status, finalUrl }
  } catch (error) {
    return {
      state: 'hard',
      status: 'ERR',
      finalUrl: '',
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  const urls = await collectUrls()
  const uniqueUrls = [...urls.keys()].sort()

  if (uniqueUrls.length === 0) {
    console.log('No outbound links found.')
    return
  }

  let hardFailures = 0
  let softBlocks = 0

  for (const url of uniqueUrls) {
    const result = await checkUrl(url)
    const files = [...(urls.get(url) ?? [])].join(', ')

    if (result.state === 'ok') {
      console.log(`[OK]   ${result.status} ${url}`)
      continue
    }

    if (result.state === 'soft') {
      softBlocks += 1
      console.log(`[SOFT] ${result.status} ${url} -> ${result.finalUrl} (source: ${files})`)
      continue
    }

    hardFailures += 1
    const detail = result.status === 'ERR' ? result.error : `${result.status} -> ${result.finalUrl}`
    console.log(`[FAIL] ${url} (${detail}) (source: ${files})`)
  }

  console.log(`\nChecked ${uniqueUrls.length} URLs | hard failures: ${hardFailures} | soft blocks: ${softBlocks}`)

  if (hardFailures > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
