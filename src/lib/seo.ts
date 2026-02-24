type FinancialProductInput = {
  name: string
  description: string
  url: string
  issuer?: string
  annualFeeAmount?: number
  annualFeeCurrency?: string
}

type ProgramSchemaInput = {
  name: string
  description: string
  url: string
}

export function generateCardJsonLd(input: FinancialProductInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: input.name,
    description: input.description,
    url: input.url,
    provider: input.issuer ? { '@type': 'Organization', name: input.issuer } : undefined,
    annualPercentageRate: undefined,
    feesAndCommissionsSpecification:
      typeof input.annualFeeAmount === 'number'
        ? {
            '@type': 'PriceSpecification',
            price: input.annualFeeAmount,
            priceCurrency: input.annualFeeCurrency ?? 'USD',
          }
        : undefined,
  }
}

export function generateProgramJsonLd(input: ProgramSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: input.name,
    description: input.description,
    url: input.url,
  }
}
