export type Region = 'us' | 'in'

export interface RegionConfig {
  id: Region
  label: string
  currency: 'USD' | 'INR'
  currencySymbol: '$' | '₹'
  flag: string
  defaultProgramType: string
  expertAgentPrompt: string
  defaultSpend: Record<string, string>
  programGoalMap: Record<string, string[]>
}

export const REGIONS: Record<Region, RegionConfig> = {
  us: {
    id: 'us',
    label: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    flag: '🇺🇸',
    defaultProgramType: 'transferable_points',
    expertAgentPrompt: 'You are an expert on US credit cards like Chase Sapphire, Amex Platinum, and Bilt. Focus on US transfer partners and dollar-based valuations.',
    defaultSpend: {
      dining: '800',
      groceries: '600',
      travel: '1500',
      gas: '150',
      streaming: '100',
      other: '2000',
    },
    programGoalMap: {
      'chase-ur': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
      'amex-mr': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
      'capital-one': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
      'citi-thankyou': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
      bilt: ['intl_econ', 'intl_biz', 'hotels', 'flex'],
      united: ['domestic', 'intl_econ', 'intl_biz'],
      delta: ['domestic', 'intl_econ', 'intl_biz'],
      american: ['domestic', 'intl_econ', 'intl_biz'],
      southwest: ['domestic'],
      alaska: ['domestic', 'intl_econ', 'intl_biz'],
      hyatt: ['hotels'],
      marriott: ['hotels'],
      hilton: ['hotels'],
      ihg: ['hotels'],
      wyndham: ['hotels'],
      'wells-fargo-rewards': ['domestic', 'intl_econ', 'flex'],
      'us-bank-altitude': ['domestic', 'intl_econ', 'intl_biz'],
      'discover-miles': ['domestic', 'intl_econ'],
    },
  },
  in: {
    id: 'in',
    label: 'India',
    currency: 'INR',
    currencySymbol: '₹',
    flag: '🇮🇳',
    defaultProgramType: 'transferable_points',
    expertAgentPrompt: 'You are an expert on Indian credit cards like HDFC Infinia, Axis Atlas, and Amex India MR. Focus on Indian transfer partners (Accor, Taj, Air India Maharaja Club) and Rupee-based valuations.',
    defaultSpend: {
      dining: '30000',
      groceries: '20000',
      travel: '60000',
      gas: '8000',
      shopping: '50000',
      streaming: '3000',
      other: '30000',
    },
    programGoalMap: {
      'hdfc-millennia': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
      'axis-edge': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
      'amex-india-mr': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
      'air-india': ['domestic', 'intl_econ', 'intl_biz'],
      'indigo-6e': ['domestic'],
      'taj-innercircle': ['hotels'],
      'sbi-reward-points': ['domestic', 'intl_econ', 'flex'],
      'amazon-pay-rewards': ['domestic'],
      'kotak-royale': ['domestic', 'intl_econ'],
      'yes-rewardz': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
      'standard-chartered-360': ['intl_econ', 'intl_biz', 'hotels'],
    },
  },
}

export const DEFAULT_REGION: Region = 'us'

export function getRegionFromPath(pathname: string): Region {
  const parts = pathname.split('/')
  const first = parts[1]?.toLowerCase()
  if (first === 'in' || first === 'us') return first as Region
  return DEFAULT_REGION
}
