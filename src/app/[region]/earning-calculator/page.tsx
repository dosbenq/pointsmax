import type { Metadata } from 'next'
import { EarningCalculatorClient } from './earning-calculator-client'
import type { Region } from '@/lib/regions'

type PageProps = {
  params: Promise<{ region: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region } = await params
  const regionLabel = region === 'in' ? 'India' : 'US'

  return {
    title: `Earning Calculator — See Which Card Earns the Most | ${regionLabel} | PointsMax`,
    description: `Compare ongoing annual points value for ${regionLabel} credit cards using your monthly spend profile.`,
  }
}

export default async function EarningCalculatorPage({ params }: PageProps) {
  const { region } = await params
  return <EarningCalculatorClient region={(region === 'in' ? 'in' : 'us') as Region} />
}
