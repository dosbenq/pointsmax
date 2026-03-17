import fs from 'node:fs'
import path from 'node:path'

const repoRoot = '/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax'
const catalogDir = path.join(repoRoot, 'Documentation', 'catalog')

const cardStagingFiles = [
  path.join(catalogDir, 'india-card-catalog-staging.csv'),
  path.join(catalogDir, 'us-card-catalog-staging.csv'),
]

const programStagingFiles = [
  path.join(catalogDir, 'india-program-catalog-staging.csv'),
  path.join(catalogDir, 'us-program-catalog-staging.csv'),
]

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
    lines.push(headers.map((header) => sanitizeCsvCell(row[header])).join(','))
  }
  return `${lines.join('\n')}\n`
}

function sanitizeCsvCell(value) {
  return String(value ?? '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
}

function buildCardSeedManifest(cardRows, programSlugByRegionAndName) {
  return cardRows.map((row) => ({
    region: row.region,
    issuer: row.issuer,
    card_name: row.card_name,
    card_slug_candidate: slugify(row.card_name),
    program_name: row.reward_program,
    program_slug_candidate:
      programSlugByRegionAndName.get(`${row.region}:${row.reward_program}`) ?? slugify(row.reward_program),
    geography: row.region,
    currency: row.region === 'IN' ? 'INR' : 'USD',
    earn_unit: row.region === 'IN' ? '100_inr' : '1_dollar',
    catalog_status: row.status,
    source_confidence: row.source_confidence,
    seed_readiness: row.status === 'active_public' ? 'ready_for_card_seed_details' : 'hold_for_verification',
    image_asset_slug: slugify(row.card_name),
  }))
}

function buildProgramSeedManifest(programRows) {
  return programRows.map((row) => ({
    region: row.region,
    program_name: row.program_name,
    short_name_candidate: row.program_name.length > 28 ? row.program_name.slice(0, 28).trim() : row.program_name,
    program_kind: row.program_kind,
    operator: row.operator,
    program_slug_candidate: row.canonical_slug_candidate,
    geography: row.region,
    catalog_status: row.status,
    source_confidence: row.source_confidence,
    seed_readiness: row.status === 'active_public' ? 'ready_for_program_seed' : 'hold_for_verification',
  }))
}

function buildOfficialImageSourceManifest(cardRows) {
  return cardRows
    .filter((row) => row.status === 'active_public')
    .map((row) => ({
      region: row.region,
      issuer: row.issuer,
      card_name: row.card_name,
      image_asset_slug: slugify(row.card_name),
      official_source_page: row.source_url,
      source_scope: row.source_scope,
      source_confidence: row.source_confidence,
      image_strategy: 'fetch_official_asset_then_self_host',
      hotlink_policy: 'do_not_hotlink_in_production',
      extraction_status: 'pending_asset_extraction',
      notes: 'Fetch from issuer page or linked CDN asset then store in our own bucket',
    }))
}

function buildLegacyVerifyBacklog(cardRows, programRows) {
  const backlog = []
  for (const row of cardRows.filter((entry) => entry.status !== 'active_public')) {
    backlog.push({
      entity_type: 'card',
      region: row.region,
      owner: row.issuer,
      name: row.card_name,
      slug_candidate: slugify(row.card_name),
      current_status: row.status,
      source_url: row.source_url,
      reason: row.notes || 'Needs manual verification before production exposure',
    })
  }
  for (const row of programRows.filter((entry) => entry.status !== 'active_public')) {
    backlog.push({
      entity_type: 'program',
      region: row.region,
      owner: row.operator,
      name: row.program_name,
      slug_candidate: row.canonical_slug_candidate,
      current_status: row.status,
      source_url: row.source_url,
      reason: row.notes || 'Needs manual verification before production exposure',
    })
  }
  return backlog
}

function buildEconomicsBacklog(cardRows) {
  return cardRows
    .filter((row) => row.status === 'active_public')
    .map((row) => ({
      region: row.region,
      issuer: row.issuer,
      card_name: row.card_name,
      program_name: row.reward_program,
      source_url: row.source_url,
      annual_fee_status: 'pending_structured_enrichment',
      signup_bonus_status: 'pending_structured_enrichment',
      signup_spend_status: 'pending_structured_enrichment',
      earn_rates_status: 'pending_structured_enrichment',
      apply_url_status: 'pending_structured_enrichment',
      notes: 'Fill from official product page before card becomes recommendation-eligible',
    }))
}

const cardRows = cardStagingFiles.flatMap(parseCsv)
const programRows = programStagingFiles.flatMap(parseCsv)
const programSlugByRegionAndName = new Map(
  programRows.map((row) => [`${row.region}:${row.program_name}`, row.canonical_slug_candidate]),
)

const cardSeedManifest = buildCardSeedManifest(cardRows, programSlugByRegionAndName)
const programSeedManifest = buildProgramSeedManifest(programRows)
const officialImageSourceManifest = buildOfficialImageSourceManifest(cardRows)
const legacyVerifyBacklog = buildLegacyVerifyBacklog(cardRows, programRows)
const economicsBacklog = buildEconomicsBacklog(cardRows)

fs.writeFileSync(
  path.join(catalogDir, 'card-seed-manifest.csv'),
  toCsv(cardSeedManifest, [
    'region',
    'issuer',
    'card_name',
    'card_slug_candidate',
    'program_name',
    'program_slug_candidate',
    'geography',
    'currency',
    'earn_unit',
    'catalog_status',
    'source_confidence',
    'seed_readiness',
    'image_asset_slug',
  ]),
)

fs.writeFileSync(
  path.join(catalogDir, 'program-seed-manifest.csv'),
  toCsv(programSeedManifest, [
    'region',
    'program_name',
    'short_name_candidate',
    'program_kind',
    'operator',
    'program_slug_candidate',
    'geography',
    'catalog_status',
    'source_confidence',
    'seed_readiness',
  ]),
)

fs.writeFileSync(
  path.join(catalogDir, 'card-official-image-source-manifest.csv'),
  toCsv(officialImageSourceManifest, [
    'region',
    'issuer',
    'card_name',
    'image_asset_slug',
    'official_source_page',
    'source_scope',
    'source_confidence',
    'image_strategy',
    'hotlink_policy',
    'extraction_status',
    'notes',
  ]),
)

fs.writeFileSync(
  path.join(catalogDir, 'legacy-verify-backlog.csv'),
  toCsv(legacyVerifyBacklog, [
    'entity_type',
    'region',
    'owner',
    'name',
    'slug_candidate',
    'current_status',
    'source_url',
    'reason',
  ]),
)

fs.writeFileSync(
  path.join(catalogDir, 'card-economics-enrichment-backlog.csv'),
  toCsv(economicsBacklog, [
    'region',
    'issuer',
    'card_name',
    'program_name',
    'source_url',
    'annual_fee_status',
    'signup_bonus_status',
    'signup_spend_status',
    'earn_rates_status',
    'apply_url_status',
    'notes',
  ]),
)
