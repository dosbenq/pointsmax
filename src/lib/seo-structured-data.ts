type FaqInput = {
  question: string
  answer: string
}

type BreadcrumbInput = {
  name: string
  url: string
}

type CardProductInput = {
  name: string
  issuer: string
  description: string
  applyUrl: string | null
  imageUrl: string | null
  region: string
}

function absolutizeUrl(url: string, baseUrl: string): string {
  return new URL(url, baseUrl).toString()
}

export function buildFaqJsonLd(faqs: FaqInput[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

export function buildBreadcrumbJsonLd(
  items: BreadcrumbInput[],
  baseUrl: string,
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absolutizeUrl(item.url, baseUrl),
    })),
  }
}

export function buildCardProductJsonLd(card: CardProductInput, baseUrl: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: card.name,
    brand: {
      '@type': 'Brand',
      name: card.issuer,
    },
    description: card.description,
    category: `Credit card (${card.region.toUpperCase()})`,
    image: card.imageUrl ? absolutizeUrl(card.imageUrl, baseUrl) : undefined,
    url: card.applyUrl ? absolutizeUrl(card.applyUrl, baseUrl) : undefined,
  }
}
