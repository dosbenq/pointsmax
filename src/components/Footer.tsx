'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getRegionFromPath, REGIONS } from '@/lib/regions'

export default function Footer() {
  const pathname = usePathname()
  const region = getRegionFromPath(pathname)
  const config = REGIONS[region]

  const productLinks = [
    { href: `/${region}`, label: 'Search' },
    { href: `/${region}/profile`, label: 'Wallet' },
  ]

  const companyLinks = [
    { href: `/${region}/privacy`, label: 'Privacy' },
    { href: `/${region}/terms`, label: 'Terms' },
  ]

  return (
    <footer className="mt-auto border-t border-pm-border bg-pm-surface text-pm-ink-900">
      <div className="pm-shell py-8">
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <p className="text-sm font-semibold text-pm-ink-900">PointsMax {config.flag}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {[...productLinks, ...companyLinks].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-pm-ink-700 transition-colors hover:text-pm-ink-900">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-6 flex flex-col gap-2 border-t border-pm-border pt-4 text-xs text-pm-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 PointsMax</p>
          <p>Points and miles for India and the US</p>
        </div>
      </div>
    </footer>
  )
}
