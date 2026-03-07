import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ region: string }>
}

export default async function EarningCalculatorPage({ params }: PageProps) {
  const { region } = await params
  redirect(`/${region}/card-recommender?view=earnings`)
}
