'use client'

import { useEffect, useState } from 'react'

type Stats = {
  total_users: number
  active_programs: number
  active_bonuses: number
  recent_signups: number
}

type LinkHealthSummary = {
  run_id: string | null
  checked_at: string | null
  totals: {
    checked: number
    broken: number
    healthy: number
  }
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [linkHealth, setLinkHealth] = useState<LinkHealthSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats').then(r => r.json()),
      fetch('/api/admin/link-health?summary=1').then(r => r.json()),
    ])
      .then(([statsData, linkData]) => {
        setStats(statsData)
        setLinkHealth(linkData)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const cards = [
    { label: 'Total users', value: stats?.total_users },
    { label: 'Active programs', value: stats?.active_programs },
    { label: 'Active bonuses', value: stats?.active_bonuses },
    { label: 'Signups (7d)', value: stats?.recent_signups },
  ]

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-8">Overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-400 mb-2">{c.label}</p>
            <p className="text-3xl font-semibold text-slate-900">
              {loading ? '—' : (c.value ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-xs text-slate-400 mb-2">Affiliate link health (latest weekly run)</p>
        <p className="text-2xl font-semibold text-slate-900">
          {loading ? '—' : `${linkHealth?.totals.broken ?? 0} broken / ${linkHealth?.totals.checked ?? 0} checked`}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {linkHealth?.checked_at ? `Checked at ${new Date(linkHealth.checked_at).toLocaleString()}` : 'No link-health run found yet.'}
        </p>
      </div>
    </div>
  )
}
