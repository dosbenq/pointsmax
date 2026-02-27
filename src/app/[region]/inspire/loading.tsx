export default function InspireLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero area */}
      <div className="bg-pm-surface border-b border-pm-border py-10">
        <div className="pm-shell space-y-3">
          <div className="h-9 w-72 rounded-xl bg-pm-surface-soft" />
          <div className="h-5 w-96 rounded-lg bg-pm-surface-soft" />
        </div>
      </div>

      <div className="pm-shell py-8 space-y-6">
        {/* Wallet summary bar */}
        <div className="flex items-center gap-4">
          <div className="h-5 w-32 rounded bg-pm-surface-soft" />
          <div className="flex gap-2">
            {[80, 96, 72, 88].map((w) => (
              <div key={w} className="h-8 rounded-full bg-pm-surface-soft" style={{ width: w }} />
            ))}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2">
          {[96, 80, 112, 72, 88].map((w) => (
            <div key={w} className="h-8 rounded-full bg-pm-surface-soft" style={{ width: w }} />
          ))}
        </div>

        {/* Destination card grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="pm-card overflow-hidden">
              {/* Image placeholder */}
              <div className="h-44 bg-pm-surface-soft" />
              {/* Content */}
              <div className="p-4 space-y-2">
                <div className="h-5 w-3/4 rounded bg-pm-surface-soft" />
                <div className="h-4 w-1/2 rounded bg-pm-surface-soft" />
                <div className="flex items-center justify-between pt-1">
                  <div className="h-6 w-20 rounded-full bg-pm-surface-soft" />
                  <div className="h-5 w-16 rounded bg-pm-surface-soft" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
