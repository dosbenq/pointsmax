import PageTransition from '@/components/PageTransition'

export default function RegionLayout({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
