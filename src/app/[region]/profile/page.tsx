import { notFound } from 'next/navigation'
import { ProfilePageContent } from '@/app/profile/page'
import type { Region } from '@/lib/regions'

export default async function RegionalProfilePage({
  params,
}: {
  params: Promise<{ region: string }>
}) {
  const { region } = await params
  if (region !== 'us' && region !== 'in') {
    notFound()
  }

  return <ProfilePageContent initialRegion={region as Region} />
}
