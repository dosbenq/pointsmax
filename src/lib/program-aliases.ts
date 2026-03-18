export type AliasTarget = {
  slugs: string[]
  aliases: string[]
}

export const PROGRAM_ALIAS_TARGETS: AliasTarget[] = [
  {
    slugs: ['chase-ultimate-rewards'],
    aliases: ['chase ur', 'chase ultimate rewards', 'chase sapphire', 'chase points'],
  },
  {
    slugs: ['amex-membership-rewards'],
    aliases: ['amex mr', 'amex membership rewards', 'american express membership rewards', 'membership rewards'],
  },
  {
    slugs: ['citi-thankyou-rewards', 'citi-thankyou'],
    aliases: ['citi thankyou', 'citi thank you', 'thankyou points', 'citi ty'],
  },
  {
    slugs: ['capital-one-miles'],
    aliases: ['capital one miles', 'venture miles', 'venture x miles', 'venture miles rewards'],
  },
  {
    slugs: ['bilt-rewards'],
    aliases: ['bilt', 'bilt rewards'],
  },
  {
    slugs: ['wells-fargo-rewards'],
    aliases: ['wells fargo rewards', 'autograph rewards'],
  },
  {
    slugs: ['united-mileageplus', 'united-mileage-plus'],
    aliases: ['united', 'mileageplus', 'united mileage plus'],
  },
  {
    slugs: ['delta-skymiles', 'delta'],
    aliases: ['delta', 'delta skymiles', 'skymiles'],
  },
  {
    slugs: ['american-airlines-aadvantage', 'aadvantage'],
    aliases: ['american airlines', 'aadvantage', 'aa miles', 'american aadvantage'],
  },
  {
    slugs: ['southwest-rapid-rewards'],
    aliases: ['southwest', 'rapid rewards'],
  },
  {
    slugs: ['alaska-mileage-plan'],
    aliases: ['alaska', 'alaska airlines', 'mileage plan'],
  },
  {
    slugs: ['jetblue-trueblue'],
    aliases: ['jetblue', 'trueblue'],
  },
  {
    slugs: ['british-airways-avios'],
    aliases: ['avios', 'british airways', 'ba avios', 'british airways avios'],
  },
  {
    slugs: ['aeroplan', 'air-canada-aeroplan'],
    aliases: ['aeroplan', 'air canada aeroplan', 'air canada'],
  },
  {
    slugs: ['krisflyer', 'singapore-krisflyer'],
    aliases: ['krisflyer', 'singapore airlines', 'singapore krisflyer', 'singapore'],
  },
  {
    slugs: ['flying-blue'],
    aliases: ['flying blue', 'air france klm', 'air france', 'klm'],
  },
  {
    slugs: ['world-of-hyatt'],
    aliases: ['hyatt', 'world of hyatt'],
  },
  {
    slugs: ['marriott-bonvoy'],
    aliases: ['marriott', 'bonvoy', 'marriott bonvoy'],
  },
  {
    slugs: ['hilton-honors'],
    aliases: ['hilton', 'hilton honors'],
  },
  {
    slugs: ['hdfc-reward-points', 'hdfc-rewards', 'hdfc-smartbuy-rewards', 'hdfc-diners-club-rewards', 'hdfc-regalia-rewards'],
    aliases: ['hdfc rewards', 'hdfc smartbuy', 'hdfc diners', 'hdfc regalia', 'hdfc diners rewards'],
  },
  {
    slugs: ['axis-edge-rewards', 'axis-edge-miles', 'axis-edge'],
    aliases: ['axis edge', 'axis edge rewards', 'axis miles'],
  },
  {
    slugs: ['icici-rewards', 'icici-payback'],
    aliases: ['payback', 'icici rewards', 'icici payback'],
  },
  {
    slugs: ['air-india-maharaja-club', 'air-india'],
    aliases: ['air india', 'maharaja club', 'flying returns', 'air india maharaja club'],
  },
  {
    slugs: ['indigo-bluchip', 'indigo-6e-rewards', 'indigo-6e'],
    aliases: ['indigo', '6e rewards', 'indigo bluchip', 'bluchip'],
  },
  {
    slugs: ['amex-membership-rewards-india', 'amex-india-mr'],
    aliases: ['amex india', 'amex india mr', 'american express india', 'india membership rewards'],
  },
]

export function normalizeAliasValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/®/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
