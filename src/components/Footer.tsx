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
    { href: `/${region}/cards`, label: 'Cards Directory' },
    { href: `/${region}/programs`, label: 'Programs Directory' },
    { href: `/${region}/award-search`, label: 'Award Search' },
    { href: `/${region}/inspire`, label: 'Inspire Me' },
    { href: `/${region}/trip-builder`, label: 'Trip Builder' },
    { href: `/${region}/earning-calculator`, label: 'Earning Calculator' },
    { href: `/${region}/card-recommender`, label: 'Card Recommender' },
  ]

  const resourceLinks = [
    { href: `/${region}/how-it-works`, label: 'How it works' },
    { href: `/${region}/pricing`, label: 'Pricing' },
    { href: `/${region}/privacy`, label: 'Privacy' },
    { href: `/${region}/terms`, label: 'Terms' },
  ]

  return (
    <footer className="mt-auto border-t border-[#d5e5d9] bg-[rgba(238,247,241,0.72)]">
      <div className="pm-shell py-12">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5 space-y-4">
            <span className="pm-pill">Points intelligence for real travelers {config.flag}</span>
            <h3 className="pm-heading text-2xl">Use your points with confidence.</h3>
            <p className="pm-subtle text-sm max-w-md">
              PointsMax helps you decide faster with wallet-aware recommendations, transfer insights,
              and practical booking paths.
            </p>

            <div className="flex items-center gap-4 pt-2">
              <Link 
                href="/us" 
                className={`text-xs flex items-center gap-1.5 px-2 py-1 rounded-md border ${region === 'us' ? 'bg-white border-[#a9d8cf] text-[#0f3f36]' : 'border-transparent text-[#59766a] hover:text-[#0f766e]'}`}
              >
                <span>🇺🇸</span> US Edition
              </Link>
              <Link 
                href="/in" 
                className={`text-xs flex items-center gap-1.5 px-2 py-1 rounded-md border ${region === 'in' ? 'bg-white border-[#a9d8cf] text-[#0f3f36]' : 'border-transparent text-[#59766a] hover:text-[#0f766e]'}`}
              >
                <span>🇮🇳</span> India Edition
              </Link>
            </div>
          </div>

          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <p className="pm-label mb-3">Product</p>
              <ul className="space-y-2.5">
                {productLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-[#264338] hover:text-[#0f766e] transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="pm-label mb-3">Resources</p>
              <ul className="space-y-2.5">
                {resourceLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-[#264338] hover:text-[#0f766e] transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="pm-label mb-3">Data</p>
              <ul className="space-y-2.5 text-sm text-[#59766a]">
                <li>Monthly valuation updates</li>
                <li>Transfer partner mapping</li>
                <li>Award planning workflows</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-5 border-t border-[#d7e8dc] flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p className="text-xs text-[#688477]">© 2026 PointsMax</p>
          <p className="text-xs text-[#688477]">Built for better redemption decisions</p>
        </div>
      </div>
    </footer>
  )
}
