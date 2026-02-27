export default function EarningCalculatorLoading() {
  return (
    <div className="pm-shell py-10 animate-pulse space-y-6">
      {/* Heading */}
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-xl bg-pm-border" />
        <div className="h-5 w-80 rounded-lg bg-pm-surface-soft" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Left: inputs */}
        <div className="pm-card p-5 space-y-4 h-fit">
          <div className="h-4 w-20 rounded bg-pm-surface-soft" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-pm-surface-soft" />
              <div className="h-10 rounded-xl bg-pm-surface-soft" />
            </div>
          ))}
          <div className="h-10 rounded-full bg-pm-surface-soft" />
        </div>

        {/* Right: earn rate table */}
        <div className="pm-card overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-4 px-5 py-3 border-b border-pm-border">
            {[180, 100, 80, 80].map((w, i) => (
              <div key={i} className="h-3 rounded bg-pm-surface-soft" style={{ width: w }} />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-pm-border">
              <div className="h-4 w-44 rounded bg-pm-surface-soft" />
              <div className="h-4 w-24 rounded bg-pm-surface-soft" />
              <div className="h-4 w-20 rounded bg-pm-surface-soft" />
              <div className="h-6 w-20 rounded-full bg-pm-surface-soft" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
