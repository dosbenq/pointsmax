'use client'

import { useEffect, useState } from 'react'

type BonusProgram = { id: string; name: string; short_name: string }

type Bonus = {
  id: string
  transfer_partner_id: string
  bonus_pct: number
  start_date: string
  end_date: string
  source_url: string | null
  is_verified: boolean
  notes: string | null
  created_at: string
  from_program: BonusProgram | null
  to_program: BonusProgram | null
}

type Partner = {
  id: string
  from_program_id: string
  to_program_id: string
  from_program_name: string
  to_program_name: string
}

const EMPTY_FORM = {
  transfer_partner_id: '',
  bonus_pct: '',
  start_date: '',
  end_date: '',
  source_url: '',
  notes: '',
}

export default function AdminBonuses() {
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

  async function load() {
    const data = await fetch('/api/admin/bonuses').then(r => r.json())
    setBonuses(data.bonuses ?? [])
    setPartners(data.partners ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addBonus(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const res = await fetch('/api/admin/bonuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Error'); setSubmitting(false); return }
    setForm(EMPTY_FORM)
    setSubmitting(false)
    await load()
  }

  async function deleteBonus(id: string) {
    setDeleting(d => ({ ...d, [id]: true }))
    await fetch(`/api/admin/bonuses/${id}`, { method: 'DELETE' })
    await load()
    setDeleting(d => ({ ...d, [id]: false }))
  }

  const today = new Date().toISOString().split('T')[0]
  const isActive = (bonus: Bonus) =>
    bonus.start_date <= today && bonus.end_date >= today

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-8">Transfer Bonuses</h1>

      {/* Add bonus form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
        <h2 className="font-semibold text-slate-900 mb-5">Add bonus</h2>
        <form onSubmit={addBonus} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Transfer pair */}
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                Transfer pair
              </label>
              <select
                value={form.transfer_partner_id}
                onChange={e => setForm(f => ({ ...f, transfer_partner_id: e.target.value }))}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              >
                <option value="">Select pair…</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.from_program_name} → {p.to_program_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Bonus % */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                Bonus %
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={form.bonus_pct}
                onChange={e => setForm(f => ({ ...f, bonus_pct: e.target.value }))}
                placeholder="e.g. 30"
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            {/* Start date */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            {/* End date */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                End date
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            {/* Source URL */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                Source URL (optional)
              </label>
              <input
                type="url"
                value={form.source_url}
                onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))}
                placeholder="https://…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-colors"
          >
            {submitting ? 'Adding…' : 'Add bonus'}
          </button>
        </form>
      </div>

      {/* Bonuses table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">
            All bonuses
            <span className="text-slate-400 font-normal text-sm ml-2">({bonuses.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-slate-400">Loading…</div>
        ) : bonuses.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-400">No bonuses yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Pair</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Bonus</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Dates</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bonuses.map(bonus => (
                <tr key={bonus.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 text-slate-900">
                    <span className="font-medium">{bonus.from_program?.short_name ?? '?'}</span>
                    <span className="text-slate-400 mx-1.5">→</span>
                    <span>{bonus.to_program?.short_name ?? '?'}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-emerald-600 font-semibold">+{bonus.bonus_pct}%</span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">
                    {bonus.start_date} – {bonus.end_date}
                  </td>
                  <td className="px-5 py-3.5">
                    {isActive(bonus) ? (
                      <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Expired</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => deleteBonus(bonus.id)}
                      disabled={deleting[bonus.id]}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                    >
                      {deleting[bonus.id] ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
