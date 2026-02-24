'use client'

import { useEffect, useState } from 'react'

type AuditRow = {
  id: string
  admin_email: string
  action: string
  target_id: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

export default function AdminAuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/audit-log')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load audit log')
        const data = await res.json() as { rows?: AuditRow[] }
        setRows(data.rows ?? [])
      })
      .catch(() => setError('Failed to load audit log.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Audit Log</h1>
      <p className="text-sm text-slate-500 mb-6">Latest 100 admin write actions.</p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">When</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Target</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={5} className="px-4 py-4">
                    <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No admin actions logged yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-700">{row.admin_email}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.action}</td>
                  <td className="px-4 py-3 text-slate-700">{row.target_id ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <pre className="whitespace-pre-wrap break-words font-mono">{JSON.stringify(row.payload ?? {}, null, 2)}</pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
