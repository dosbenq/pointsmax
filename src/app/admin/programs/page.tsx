'use client'

import { useEffect, useState } from 'react'

type Valuation = {
  id: string
  cpp_cents: number
  source: string
  effective_date: string
}

type Program = {
  id: string
  name: string
  short_name: string
  type: string
  color_hex: string
  is_active: boolean
  latest_valuation: Valuation | null
}

const TYPE_LABELS: Record<string, string> = {
  transferable_points: 'Transferable',
  airline_miles: 'Airline',
  hotel_points: 'Hotel',
  cashback: 'Cashback',
}

const SOURCE_OPTIONS = ['tpg', 'nerdwallet', 'manual']

export default function AdminPrograms() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [sources, setSources] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  async function load() {
    const data = await fetch('/api/admin/programs').then(r => r.json())
    setPrograms(data.programs ?? [])
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    fetch('/api/admin/programs')
      .then(r => r.json())
      .then(data => {
        if (!active) return
        setPrograms(data.programs ?? [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function saveCpp(program: Program) {
    const cpp = edits[program.id]
    if (!cpp) return
    setSaving(s => ({ ...s, [program.id]: true }))

    await fetch('/api/admin/programs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        program_id: program.id,
        cpp_cents: parseFloat(cpp),
        source: sources[program.id] ?? 'manual',
      }),
    })

    await load()
    setEdits(e => {
      const next = { ...e }
      delete next[program.id]
      return next
    })
    setSaving(s => ({ ...s, [program.id]: false }))
    setSaved(s => ({ ...s, [program.id]: true }))
    setTimeout(() => setSaved(s => ({ ...s, [program.id]: false })), 2000)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Programs & CPP Valuations</h1>
      <p className="text-sm text-slate-500 mb-8">
        Edit a CPP value and click Save — a new valuation record is inserted (history is preserved).
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Program</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-36">CPP (¢)</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Source</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-3.5 bg-slate-100 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              : programs.map(p => {
                  const currentCpp = p.latest_valuation?.cpp_cents
                  const editVal = edits[p.id]
                  const isDirty = editVal !== undefined
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      {/* Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: p.color_hex }}
                          />
                          <span className="font-medium text-slate-900">{p.short_name}</span>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-slate-400">
                          {TYPE_LABELS[p.type] ?? p.type}
                        </span>
                      </td>

                      {/* CPP editable */}
                      <td className="px-5 py-3.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editVal ?? (currentCpp ?? '')}
                          onChange={e =>
                            setEdits(ed => ({ ...ed, [p.id]: e.target.value }))
                          }
                          className="w-24 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                        />
                      </td>

                      {/* Source */}
                      <td className="px-5 py-3.5">
                        <select
                          value={sources[p.id] ?? (p.latest_valuation?.source ?? 'manual')}
                          onChange={e =>
                            setSources(s => ({ ...s, [p.id]: e.target.value }))
                          }
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                        >
                          {SOURCE_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>

                      {/* Last updated */}
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {p.latest_valuation?.effective_date ?? '—'}
                      </td>

                      {/* Save */}
                      <td className="px-4 py-3.5">
                        {saved[p.id] ? (
                          <span className="text-xs text-emerald-600 font-medium">Saved</span>
                        ) : (
                          <button
                            onClick={() => saveCpp(p)}
                            disabled={!isDirty || saving[p.id]}
                            className="text-xs bg-slate-900 hover:bg-slate-700 disabled:opacity-30 text-white px-3 py-1.5 rounded-full transition-colors"
                          >
                            {saving[p.id] ? '…' : 'Save'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
