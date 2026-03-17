'use client'

import { FormEvent, useEffect, useState } from 'react'

type Creator = {
  id: string
  name: string
  slug: string
  platform: string | null
  profile_url: string | null
}

type CreatorStats = {
  clicks: number
  conversions: number
  conversion_rate: number
  unique_cards_clicked: number
  estimated_revenue_usd: number
}

export default function AdminCreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([])
  const [stats, setStats] = useState<Record<string, CreatorStats>>({})
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', slug: '', platform: 'youtube', profile_url: '' })
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/creators')
      const data = await res.json()
      const rows = (data.creators ?? []) as Creator[]
      setCreators(rows)

      const statsEntries = await Promise.all(
        rows.map(async (creator) => {
          const statRes = await fetch(`/api/admin/creators/${encodeURIComponent(creator.slug)}/stats`)
          const statData = await statRes.json()
          return [creator.slug, statData] as const
        }),
      )
      setStats(Object.fromEntries(statsEntries))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function createCreator(e: FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/admin/creators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const payload = await res.json().catch(() => ({ error: 'Failed to create creator' }))
    if (!res.ok) {
      setError(payload.error ?? 'Failed to create creator')
      return
    }
    setForm({ name: '', slug: '', platform: 'youtube', profile_url: '' })
    await load()
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Creator Referrals</h1>

      <form onSubmit={createCreator} className="bg-white border border-slate-200 rounded-xl p-5 grid sm:grid-cols-2 gap-3">
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Creator name"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          required
        />
        <input
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          placeholder="slug (e.g. sharan-hegde)"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          required
        />
        <input
          value={form.platform}
          onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
          placeholder="Platform"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={form.profile_url}
          onChange={(e) => setForm((f) => ({ ...f, profile_url: e.target.value }))}
          placeholder="Profile URL"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <div className="sm:col-span-2 flex items-center justify-between">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm">Add creator</button>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Creator</th>
              <th className="px-4 py-2 text-left">Ref Link</th>
              <th className="px-4 py-2 text-left">Clicks (30d)</th>
              <th className="px-4 py-2 text-left">Conversions</th>
              <th className="px-4 py-2 text-left">Conv. rate</th>
              <th className="px-4 py-2 text-left">Est. revenue</th>
            </tr>
          </thead>
          <tbody>
            {creators.map((creator) => {
              const rowStats = stats[creator.slug]
              return (
                <tr key={creator.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-900">{creator.name}</p>
                    <p className="text-xs text-slate-500">{creator.platform ?? '—'}</p>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <code>{`/?ref=${creator.slug}`}</code>
                  </td>
                  <td className="px-4 py-2">{loading ? '—' : (rowStats?.clicks ?? 0)}</td>
                  <td className="px-4 py-2">{loading ? '—' : (rowStats?.conversions ?? 0)}</td>
                  <td className="px-4 py-2">{loading ? '—' : `${rowStats?.conversion_rate ?? 0}%`}</td>
                  <td className="px-4 py-2">${loading ? '—' : (rowStats?.estimated_revenue_usd ?? 0)}</td>
                </tr>
              )
            })}
            {!loading && creators.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No creators configured yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
