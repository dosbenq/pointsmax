import { describe, expect, it } from 'vitest'
import { catalog, findStaleValuations, validateCatalog } from './catalog-core.mjs'

const today = '2026-10-04'

describe('points catalog (src/data/catalog)', () => {
  it('is valid', () => {
    expect(validateCatalog(catalog, { today })).toEqual([])
  })

  it('has one valuation per active programme', () => {
    const active = catalog.programs.filter((p) => p.is_active).map((p) => p.slug).sort()
    expect(catalog.valuations.map((v) => v.program).sort()).toEqual(active)
  })
})

describe('validateCatalog', () => {
  const base = () => structuredClone(catalog)

  it('rejects an India valuation entered in rupees instead of paise', () => {
    const c = base()
    const hdfc = c.valuations.find((v) => v.program === 'hdfc-smartbuy')!
    hdfc.cpp = 1.2
    expect(validateCatalog(c, { today })).toContainEqual(expect.stringContaining('hdfc-smartbuy cpp 1.2 paise'))
  })

  it('rejects a US valuation tagged with the wrong unit', () => {
    const c = base()
    const chase = c.valuations.find((v) => v.program === 'chase-ur')!
    chase.unit = 'paise'
    expect(validateCatalog(c, { today })).toContainEqual(expect.stringContaining('chase-ur must use unit "cents"'))
  })

  it('rejects references to programmes that do not exist', () => {
    const c = base()
    c.transferPartners.push({ ...c.transferPartners[0], to: 'avios' })
    c.valuations.push({ ...c.valuations[0], program: 'wells-fargo-rewards' })
    const errors = validateCatalog(c, { today })
    expect(errors).toContainEqual(expect.stringContaining('unknown target programme "avios"'))
    expect(errors).toContainEqual(expect.stringContaining('unknown programme "wells-fargo-rewards"'))
  })

  it('rejects duplicate routes, uppercase geographies and future review dates', () => {
    const c = base()
    c.transferPartners.push(c.transferPartners[0])
    c.programs[0].geography = 'GLOBAL' as never
    c.valuations[0].reviewed_at = '2027-01-01'
    const errors = validateCatalog(c, { today })
    expect(errors).toContainEqual(expect.stringContaining('duplicate route'))
    expect(errors).toContainEqual(expect.stringContaining('unknown geography "GLOBAL"'))
    expect(errors).toContainEqual(expect.stringContaining('is in the future'))
  })
})

describe('findStaleValuations', () => {
  it('flags values older than the threshold and placeholders', () => {
    const stale = findStaleValuations(catalog, { today: '2026-10-04', staleAfterDays: 60 })
    const slugs = stale.map((s) => s.program)
    expect(slugs).toContain('flying-blue') // last reviewed Jan 2025
    expect(slugs).toContain('accor') // placeholder
    expect(stale[0].age_days).toBeGreaterThanOrEqual(stale[stale.length - 1].age_days)
  })
})
