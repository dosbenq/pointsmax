import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Column 1: Logo + tagline */}
          <div className="col-span-2 md:col-span-1">
            <p className="font-semibold text-slate-900 mb-2">PointsMax</p>
            <p className="text-slate-500 text-sm leading-relaxed">
              Maximize every point in your wallet with AI-powered redemption analysis.
            </p>
          </div>

          {/* Column 2: Product */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Product</p>
            <ul className="space-y-2">
              <li>
                <Link href="/calculator" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
                  Calculator
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Legal</p>
            <ul className="space-y-2">
              <li>
                <span className="text-sm text-slate-400 cursor-not-allowed">Privacy Policy</span>
              </li>
              <li>
                <span className="text-sm text-slate-400 cursor-not-allowed">Terms of Service</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Built with */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Built with</p>
            <ul className="space-y-2">
              <li className="text-sm text-slate-500">Next.js 15</li>
              <li className="text-sm text-slate-500">Supabase</li>
              <li className="text-sm text-slate-500">Google Gemini</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-400">© 2025 PointsMax</p>
          <p className="text-xs text-slate-400">Valuations sourced from TPG</p>
        </div>
      </div>
    </footer>
  )
}
