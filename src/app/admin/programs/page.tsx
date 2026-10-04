import { catalog, findStaleValuations, STALE_AFTER_DAYS } from '@/lib/catalog'

const TYPE_LABELS: Record<string, string> = {
  transferable_points: 'Transferable',
  airline_miles: 'Airline',
  hotel_points: 'Hotel',
  cashback: 'Cashback',
}

export default function AdminPrograms() {
  const valuationBySlug = new Map(catalog.valuations.map((v) => [v.program, v]))
  const staleBySlug = new Map(findStaleValuations(catalog).map((s) => [s.program, s]))
  const programs = [...catalog.programs].sort(
    (a, b) => a.geography.localeCompare(b.geography) || a.display_order - b.display_order,
  )

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Programs & CPP Valuations</h1>
      <p className="text-sm text-slate-500 mb-2">
        Valuations live in <code className="text-slate-700">src/data/catalog/valuations.json</code>. To change one,
        edit the value and its <code className="text-slate-700">reviewed_at</code> date, then run{' '}
        <code className="text-slate-700">npm run catalog:sync</code>.
      </p>
      <p className="text-sm text-slate-500 mb-8">
        {staleBySlug.size} of {catalog.valuations.length} values are due for review (older than {STALE_AFTER_DAYS} days,
        or placeholders).
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Program', 'Region', 'Type', 'Value', 'Source', 'Reviewed'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {programs.map((p) => {
              const v = valuationBySlug.get(p.slug)
              const stale = staleBySlug.get(p.slug)
              return (
                <tr key={p.slug} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.color_hex ?? '#94a3b8' }}
                      />
                      <span className="font-medium text-slate-900">{p.short_name}</span>
                      <span className="text-xs text-slate-400">{p.slug}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">{p.geography}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">{TYPE_LABELS[p.type] ?? p.type}</td>
                  <td className="px-5 py-3.5 text-slate-900">
                    {v ? `${v.cpp} ${v.unit === 'paise' ? 'paise' : '¢'}` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">
                    {v?.source_url ? (
                      <a href={v.source_url} target="_blank" rel="noreferrer" className="underline">
                        {v.source}
                      </a>
                    ) : (v?.source ?? '—')}
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    <span className={stale ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                      {v?.reviewed_at ?? '—'}
                      {stale ? (stale.needs_review ? ' · placeholder' : ` · ${stale.age_days}d old`) : ''}
                    </span>
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
