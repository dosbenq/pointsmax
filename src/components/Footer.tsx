import Link from 'next/link'

const PRODUCT_LINKS = [
  { href: '/calculator', label: 'Calculator' },
  { href: '/award-search', label: 'Award Search' },
  { href: '/inspire', label: 'Inspire Me' },
  { href: '/trip-builder', label: 'Trip Builder' },
  { href: '/earning-calculator', label: 'Earning Calculator' },
  { href: '/card-recommender', label: 'Card Recommender' },
]

const RESOURCE_LINKS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
]

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[#d5e5d9] bg-[rgba(238,247,241,0.72)]">
      <div className="pm-shell py-12">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5 space-y-4">
            <span className="pm-pill">Points intelligence for real travelers</span>
            <h3 className="pm-heading text-2xl">Use your points with confidence.</h3>
            <p className="pm-subtle text-sm max-w-md">
              PointsMax helps you decide faster with wallet-aware recommendations, transfer insights,
              and practical booking paths.
            </p>
          </div>

          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <p className="pm-label mb-3">Product</p>
              <ul className="space-y-2.5">
                {PRODUCT_LINKS.map((item) => (
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
                {RESOURCE_LINKS.map((item) => (
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
