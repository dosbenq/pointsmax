import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = '/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax'
const catalogDir = path.join(repoRoot, 'Documentation', 'catalog')
const outputPath = path.join(repoRoot, 'supabase', 'migrations', '036_catalog_staging_seed.sql')

const cardFiles = [
  path.join(catalogDir, 'india-card-catalog-staging.csv'),
  path.join(catalogDir, 'us-card-catalog-staging.csv'),
]

const programFiles = [
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

function escapeSql(value) {
  return String(value ?? '').replace(/'/g, "''")
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
}

function deterministicUuid(namespace, value) {
  const hex = crypto.createHash('md5').update(`${namespace}:${value}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

const cardRows = cardFiles.flatMap(parseCsv)
const programRows = programFiles.flatMap(parseCsv)
const programSlugByRegionAndName = new Map(
  programRows.map((row) => [`${row.region}:${row.program_name}`, row.canonical_slug_candidate]),
)

const programValues = programRows.map((row) => {
  const id = deterministicUuid('catalog-program-staging', `${row.region}:${row.canonical_slug_candidate}`)
  const shortName = row.program_name.length > 28 ? row.program_name.slice(0, 28).trim() : row.program_name
  return `('${id}','${escapeSql(row.region)}','${escapeSql(row.program_name)}','${escapeSql(shortName)}','${escapeSql(row.program_kind)}','${escapeSql(row.operator)}','${escapeSql(row.canonical_slug_candidate)}','${escapeSql(row.region)}','${escapeSql(row.status)}','${escapeSql(row.source_confidence)}','${row.status === 'active_public' ? 'ready_for_program_seed' : 'hold_for_verification'}','${escapeSql(row.source_url)}','${escapeSql(row.source_scope)}')`
})

const cardValues = cardRows.map((row) => {
  const cardSlug = slugify(row.card_name)
  const programSlug =
    programSlugByRegionAndName.get(`${row.region}:${row.reward_program}`) ?? slugify(row.reward_program)
  const id = deterministicUuid('catalog-card-staging', `${row.region}:${cardSlug}`)
  return `('${id}','${escapeSql(row.region)}','${escapeSql(row.issuer)}','${escapeSql(row.card_name)}','${escapeSql(cardSlug)}','${escapeSql(row.reward_program)}','${escapeSql(programSlug)}','${escapeSql(row.region)}','${row.region === 'IN' ? 'INR' : 'USD'}','${row.region === 'IN' ? '100_inr' : '1_dollar'}','${escapeSql(row.status)}','${escapeSql(row.source_confidence)}','${row.status === 'active_public' ? 'ready_for_card_seed_details' : 'hold_for_verification'}','${escapeSql(cardSlug)}','${escapeSql(row.source_url)}','${escapeSql(row.source_scope)}','fetch_official_asset_then_self_host','pending_asset_extraction')`
  })

const sql = `-- ============================================================
-- PointsMax — Migration 036
-- Catalog staging seed data generated from Documentation/catalog
-- ============================================================

INSERT INTO public.catalog_programs_staging (
  id,
  region,
  program_name,
  short_name_candidate,
  program_kind,
  operator_name,
  program_slug_candidate,
  geography,
  catalog_status,
  source_confidence,
  seed_readiness,
  source_url,
  source_scope
)
VALUES
${programValues.join(',\n')}
ON CONFLICT (region, program_slug_candidate) DO UPDATE SET
  program_name = EXCLUDED.program_name,
  short_name_candidate = EXCLUDED.short_name_candidate,
  program_kind = EXCLUDED.program_kind,
  operator_name = EXCLUDED.operator_name,
  geography = EXCLUDED.geography,
  catalog_status = EXCLUDED.catalog_status,
  source_confidence = EXCLUDED.source_confidence,
  seed_readiness = EXCLUDED.seed_readiness,
  source_url = EXCLUDED.source_url,
  source_scope = EXCLUDED.source_scope,
  updated_at = now();

INSERT INTO public.catalog_cards_staging (
  id,
  region,
  issuer_name,
  card_name,
  card_slug_candidate,
  program_name,
  program_slug_candidate,
  geography,
  currency,
  earn_unit,
  catalog_status,
  source_confidence,
  seed_readiness,
  image_asset_slug,
  source_url,
  source_scope,
  official_image_strategy,
  official_image_status
)
VALUES
${cardValues.join(',\n')}
ON CONFLICT (region, card_slug_candidate) DO UPDATE SET
  issuer_name = EXCLUDED.issuer_name,
  card_name = EXCLUDED.card_name,
  program_name = EXCLUDED.program_name,
  program_slug_candidate = EXCLUDED.program_slug_candidate,
  geography = EXCLUDED.geography,
  currency = EXCLUDED.currency,
  earn_unit = EXCLUDED.earn_unit,
  catalog_status = EXCLUDED.catalog_status,
  source_confidence = EXCLUDED.source_confidence,
  seed_readiness = EXCLUDED.seed_readiness,
  image_asset_slug = EXCLUDED.image_asset_slug,
  source_url = EXCLUDED.source_url,
  source_scope = EXCLUDED.source_scope,
  official_image_strategy = EXCLUDED.official_image_strategy,
  official_image_status = EXCLUDED.official_image_status,
  updated_at = now();
`

fs.writeFileSync(outputPath, sql)
console.log(`Wrote ${outputPath}`)
