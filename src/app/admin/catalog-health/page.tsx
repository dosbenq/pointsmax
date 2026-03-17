'use client'

import { useEffect, useState } from 'react'
import type { CatalogHealthIssue, CatalogHealthReport } from '@/lib/catalog-health'

const EMPTY_REPORT: CatalogHealthReport = {
  missing_apply_url: [],
  missing_image_url: [],
  suspicious_signup_bonus: [],
  weak_earning_rates: [],
  stale_cards: [],
}

function IssueTable({ title, rows }: { title: string; rows: CatalogHealthIssue[] }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <span className="text-xs text-slate-500">{rows.length} cards</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">Card</th>
            <th className="px-4 py-2 text-left">Issuer</th>
            <th className="px-4 py-2 text-left">Region</th>
            <th className="px-4 py-2 text-left">Stale</th>
            <th className="px-4 py-2 text-left">Fix</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.card_id}`} className="border-t border-slate-100">
              <td className="px-4 py-2 font-medium text-slate-900">{row.name}</td>
              <td className="px-4 py-2 text-slate-600">{row.issuer}</td>
              <td className="px-4 py-2 text-slate-600">{row.geography}</td>
              <td className="px-4 py-2 text-slate-600">{row.stale_days == null ? '—' : `${row.stale_days}d`}</td>
              <td className="px-4 py-2">
                <a
                  href={`/admin/programs?focusCard=${encodeURIComponent(row.card_id)}`}
                  className="text-slate-900 underline underline-offset-2"
                >
                  Review
                </a>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                No issues in this bucket.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

export default function AdminCatalogHealthPage() {
  const [report, setReport] = useState<CatalogHealthReport>(EMPTY_REPORT)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const response = await fetch('/api/admin/catalog-health')
        const payload = await response.json()
        setReport((payload.report ?? EMPTY_REPORT) as CatalogHealthReport)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Catalog Health</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review missing apply URLs, image coverage, weak earn-rate data, and stale cards before they degrade the recommender.
        </p>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500">
          Loading catalog health…
        </div>
      ) : (
        <div className="grid gap-6">
          <IssueTable title="Missing apply URLs" rows={report.missing_apply_url} />
          <IssueTable title="Missing image URLs" rows={report.missing_image_url} />
          <IssueTable title="Suspicious signup bonuses" rows={report.suspicious_signup_bonus} />
          <IssueTable title="Weak earning rates" rows={report.weak_earning_rates} />
          <IssueTable title="Stale cards (90+ days)" rows={report.stale_cards} />
        </div>
      )}
    </div>
  )
}
