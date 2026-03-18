type CardSlugIdentity = {
  id: string
  name?: string | null
  issuer?: string | null
  program_slug?: string | null
}

export function slugifyCardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getCanonicalCardSlug(card: CardSlugIdentity): string {
  const nameSlug = typeof card.name === 'string' ? slugifyCardName(card.name) : ''
  const issuerSlug = typeof card.issuer === 'string' ? slugifyCardName(card.issuer) : ''
  const programSlug = typeof card.program_slug === 'string' ? card.program_slug.trim() : ''

  if (nameSlug && issuerSlug) return `${nameSlug}-${issuerSlug}`
  if (nameSlug) return nameSlug
  if (programSlug) return programSlug
  return card.id
}

export function getCardRouteCandidates(card: CardSlugIdentity): Set<string> {
  const candidates = new Set<string>()

  const canonical = getCanonicalCardSlug(card).trim().toLowerCase()
  if (canonical) candidates.add(canonical)

  if (typeof card.program_slug === 'string' && card.program_slug.trim()) {
    candidates.add(card.program_slug.trim().toLowerCase())
  }

  if (typeof card.name === 'string' && card.name.trim()) {
    candidates.add(slugifyCardName(card.name))
  }

  if (typeof card.id === 'string' && card.id.trim()) {
    candidates.add(card.id.trim().toLowerCase())
  }

  return candidates
}

export function matchesCardRouteSlug(card: CardSlugIdentity, slug: string): boolean {
  return getCardRouteCandidates(card).has(slug.trim().toLowerCase())
}
