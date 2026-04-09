'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getRegionFromPath, REGIONS } from '@/lib/regions'

export default function Footer() {
  const pathname = usePathname()
  const region = getRegionFromPath(pathname)
  const config = REGIONS[region]

  const productLinks = [
    { href: `/${region}/calculator`, label: 'Calculator' },
    { href: `/${region}/award-search`, label: 'Award Search' },
    { href: `/${region}/hotel-search`, label: 'Hotel Search' },
    { href: `/${region}/trip-builder`, label: 'Trip Builder' },
    { href: `/${region}/card-recommender`, label: 'Card Strategy' },
    { href: `/${region}/profile`, label: 'Wallet' },
  ]

  const resourceLinks = [
    { href: `/${region}/cards`, label: 'Cards' },
    { href: `/${region}/programs`, label: 'Programs' },
    { href: `/${region}/devaluation-tracker`, label: 'Devaluation Tracker' },
    { href: `/${region}/inspire`, label: 'Playbooks' },
    { href: `/${region}/how-it-works`, label: 'How it works' },
  ]

  const companyLinks = [
    { href: `/${region}/pricing`, label: 'Pricing' },
    { href: `/${region}/privacy`, label: 'Privacy' },
    { href: `/${region}/terms`, label: 'Terms' },
  ]

  return (
    <footer className="mt-auto border-t border-pm-border bg-pm-surface text-pm-ink-900">
      <div className="pm-shell py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="max-w-2xl">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-pm-ink-500">PointsMax {config.flag}</p>
            <h2 className="mt-5 text-[2.7rem] font-semibold leading-[0.95] tracking-[-0.055em] text-pm-ink-900 sm:text-[3.7rem]">
              Better judgment for people who refuse to waste their points.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-pm-ink-700">
              PointsMax is built for people who want sharper reward decisions, clearer transfer logic, and less low-value redemption noise.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-pm-ink-500">Product</p>
              <ul className="mt-4 space-y-3.5">
                {productLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-pm-ink-700 transition-colors hover:text-pm-ink-900">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-pm-ink-500">Resources</p>
              <ul className="mt-4 space-y-3.5">
                {resourceLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-pm-ink-700 transition-colors hover:text-pm-ink-900">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-pm-ink-500">Company</p>
              <ul className="mt-4 space-y-3.5">
                {companyLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-pm-ink-700 transition-colors hover:text-pm-ink-900">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-pm-border pt-5 text-xs text-pm-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 PointsMax</p>
          <p>Wallet-aware rewards strategy for India and the US</p>
        </div>
      </div>
    </footer>
  )
}
