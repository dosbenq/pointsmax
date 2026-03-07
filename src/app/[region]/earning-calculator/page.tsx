import { permanentRedirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ region: string }>
}

export default async function EarningCalculatorPage({ params }: PageProps) {
  const { region } = await params
  permanentRedirect(`/${region}/card-recommender?view=earnings`)
}
