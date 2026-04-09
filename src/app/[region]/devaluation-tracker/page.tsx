import type { Metadata } from 'next'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Points Devaluation Tracker — PointsMax',
  description: 'Track recent devaluations across airline, hotel, and credit card loyalty programs.',
}

const DEVALUATIONS = [
  { date: 'Apr 2026', program: 'United MileagePlus', change: '1.50\u00A2 \u2192 1.35\u00A2', impact: 'HIGH', direction: 'down' as const, note: 'Dynamic pricing erosion. TPG valuation dropped.' },
  { date: 'Apr 2026', program: 'Delta SkyMiles', change: '1.25\u00A2 \u2192 1.20\u00A2', impact: 'MED', direction: 'down' as const, note: 'Continued devaluation trend.' },
  { date: 'Apr 2026', program: 'Hilton Honors', change: '0.50\u00A2 \u2192 0.40\u00A2', impact: 'HIGH', direction: 'down' as const, note: 'Multiple 2024-2026 devaluations. Luxury to 250K pts/night.' },
  { date: 'Apr 2026', program: 'AA AAdvantage', change: '1.70\u00A2 \u2192 1.60\u00A2', impact: 'MED', direction: 'down' as const, note: 'Web specials still offer good value.' },
  { date: 'Apr 2026', program: 'Wyndham Rewards', change: '1.10\u00A2 \u2192 0.65\u00A2', impact: 'CRITICAL', direction: 'down' as const, note: 'Massive 41% devaluation.' },
  { date: 'Apr 2026', program: 'Alaska Mileage Plan', change: '1.50\u00A2 \u2192 1.40\u00A2', impact: 'MED', direction: 'down' as const, note: 'Rebranded to Atmos Rewards.' },
  { date: 'Apr 2026', program: 'IHG One Rewards', change: '0.50\u00A2 \u2192 0.60\u00A2', impact: 'GOOD', direction: 'up' as const, note: 'Improved value!' },
  { date: 'Apr 2026', program: 'Marriott Bonvoy', change: '0.70\u00A2 \u2192 0.75\u00A2', impact: 'GOOD', direction: 'up' as const, note: 'Slight improvement.' },
  { date: 'Dec 2025', program: 'British Airways Avios', change: '8-14% more Avios required', impact: 'HIGH', direction: 'down' as const, note: 'Higher surcharges on awards.' },
  { date: 'Feb 2026', program: 'HDFC Infinia', change: 'Fee waiver \u20B910L \u2192 \u20B918L', impact: 'HIGH', direction: 'down' as const, note: 'India. Proposed SmartBuy 5x\u21923x rolled back after backlash.' },
  { date: 'Jan 2026', program: 'ICICI iShop', change: 'Removed 6X on Amazon Pay/Swiggy', impact: 'MED', direction: 'down' as const, note: 'India. Transport/insurance caps added.' },
  { date: 'Jun 2025', program: 'Amex Gold India', change: 'No MR points on fuel', impact: 'MED', direction: 'down' as const, note: 'India. Fuel earning completely removed.' },
  { date: 'Jun 2025', program: 'Chase Ultimate Rewards', change: 'Portal value baseline 1.25-1.5\u00A2 \u2192 1\u00A2', impact: 'MED', direction: 'down' as const, note: 'Points Boost introduced. Legacy rates until Oct 2027.' },
]

export default function DevalTrackerPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-pm-ink-900 mb-2">Points Devaluation Tracker</h1>
          <p className="text-pm-ink-500 mb-8">Stay ahead of loyalty program changes. Updated with every TPG monthly valuation.</p>

          <div className="space-y-3">
            {DEVALUATIONS.map((d, i) => (
              <div key={i} className={`p-4 rounded-xl border ${d.direction === 'up' ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{d.direction === 'up' ? '\u{1F4C8}' : '\u{1F4C9}'}</span>
                    <div>
                      <span className="font-semibold text-pm-ink-900">{d.program}</span>
                      <span className={`ml-2 text-sm font-mono ${d.direction === 'up' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{d.change}</span>
                    </div>
                  </div>
                  <span className="text-xs text-pm-ink-500">{d.date}</span>
                </div>
                <p className={`text-sm ml-9 ${d.direction === 'up' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{d.note}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-pm-ink-400 mt-8">Sources: The Points Guy monthly valuations, CardExpert.in, TechnoFino, Reddit r/churning, r/CreditCardsIndia</p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
