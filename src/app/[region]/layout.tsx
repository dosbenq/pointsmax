import { notFound } from 'next/navigation'
import PageTransition from '@/components/PageTransition'

export default async function RegionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ region: string }>
}) {
  const { region } = await params
  if (region !== 'us' && region !== 'in') {
    notFound()
  }

  return <PageTransition>{children}</PageTransition>
}
