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
      dining: '500',
      groceries: '400',
      travel: '300',
      gas: '200',
      streaming: '50',
      other: '500',
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
      dining: '20000',
      groceries: '15000',
      travel: '10000',
      gas: '5000',
      streaming: '2000',
      other: '30000',
    },
    programGoalMap: {
      'hdfc-millennia': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
      'axis-edge': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
      'amex-india-mr': ['intl_econ', 'intl_biz', 'hotels', 'flex'],
      'air-india': ['domestic', 'intl_econ', 'intl_biz'],
      'indigo-6e': ['domestic'],
      'taj-innercircle': ['hotels'],
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
