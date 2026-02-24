'use client'

import { useEffect, useState } from 'react'

type LinkHealthRow = {
  card_id: string | null
  card_name: string
  url: string
  status_code: number | null
  ok: boolean
  checked_at: string
}

type LinkHealthPayload = {
  run_id: string | null
  checked_at: string | null
  totals: {
    checked: number
    broken: number
    healthy: number
  }
  rows: LinkHealthRow[]
}

export default function AdminLinkHealthPage() {
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<LinkHealthPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/link-health')
      .then((res) => res.json())
      .then((data) => {
        setPayload(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load link health')
        setLoading(false)
      })
  }, [])

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">Affiliate Link Health</h1>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-400">Checked links</p>
              <p className="text-2xl font-semibold text-slate-900">{loading ? '—' : (payload?.totals.checked ?? 0)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-400">Broken</p>
              <p className="text-2xl font-semibold text-red-600">{loading ? '—' : (payload?.totals.broken ?? 0)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-400">Healthy</p>
              <p className="text-2xl font-semibold text-emerald-700">{loading ? '—' : (payload?.totals.healthy ?? 0)}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-xs text-slate-500">
              Latest run: {payload?.checked_at ? new Date(payload.checked_at).toLocaleString() : 'No run yet'}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">Card</th>
                  <th className="text-left px-4 py-2">URL</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.rows ?? []).map((row, idx) => (
                  <tr key={`${row.card_id ?? 'unknown'}-${idx}`} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-900">{row.card_name}</td>
                    <td className="px-4 py-2">
                      <a href={row.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        {row.url}
                      </a>
                    </td>
                    <td className="px-4 py-2">{row.status_code ?? 'timeout'}</td>
                    <td className={`px-4 py-2 font-medium ${row.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                      {row.ok ? 'OK' : 'Broken'}
                    </td>
                  </tr>
                ))}
                {!loading && (payload?.rows?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No link-health entries found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
