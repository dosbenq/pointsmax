import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ region: string }>
}

export default async function InspirePage({ params }: Props) {
  const { region } = await params
  redirect(`/${region}/calculator`)
}
