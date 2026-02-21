'use client'

import { useEffect, useState } from 'react'

type Stats = {
  total_users: number
  active_programs: number
  active_bonuses: number
  recent_signups: number
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false) })
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
    </div>
  )
}
