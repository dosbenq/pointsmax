'use client'

import { useEffect, useState } from 'react'

type User = {
  id: string
  email: string
  tier: 'free' | 'premium'
  stripe_customer_id: string | null
  created_at: string
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => { setUsers(data.users ?? []); setLoading(false) })
  }, [])

  async function updateTier(userId: string, tier: 'free' | 'premium') {
    setSaving(s => ({ ...s, [userId]: true }))
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, tier }),
    })
    setUsers(us => us.map(u => u.id === userId ? { ...u, tier } : u))
    setSaving(s => ({ ...s, [userId]: false }))
    setSaved(s => ({ ...s, [userId]: true }))
    setTimeout(() => setSaved(s => ({ ...s, [userId]: false })), 2000)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  return (
    <div className="p-8">
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
        {!loading && (
          <span className="text-sm text-slate-400">{users.length} total</span>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Tier</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Stripe</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-3.5 bg-slate-100 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : users.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-sm text-slate-400 text-center">
                    No users yet.
                  </td>
                </tr>
              )
              : users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900 max-w-xs truncate">
                      {u.email}
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={u.tier}
                        onChange={e => updateTier(u.id, e.target.value as 'free' | 'premium')}
                        disabled={saving[u.id]}
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition disabled:opacity-50"
                      >
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {u.stripe_customer_id ? (
                        <span className="font-mono">{u.stripe_customer_id.slice(0, 14)}…</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      {saved[u.id] && (
                        <span className="text-xs text-emerald-600 font-medium">Saved</span>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
