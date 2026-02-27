export default function TripBuilderLoading() {
  return (
    <div className="pm-shell py-10 animate-pulse">
      {/* Heading */}
      <div className="mb-8 space-y-2">
        <div className="h-8 w-56 rounded-xl bg-pm-border" />
        <div className="h-5 w-80 rounded-lg bg-pm-surface-soft" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Wizard panel */}
        <div className="pm-card p-6 space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-3">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-pm-surface-soft" />
                {s < 3 && <div className="h-px w-10 bg-pm-border" />}
              </div>
            ))}
          </div>

          {/* Route inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="h-4 w-16 rounded bg-pm-surface-soft" />
              <div className="h-12 rounded-xl bg-pm-surface-soft" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-12 rounded bg-pm-surface-soft" />
              <div className="h-12 rounded-xl bg-pm-surface-soft" />
            </div>
          </div>

          {/* Date inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="h-4 w-24 rounded bg-pm-surface-soft" />
              <div className="h-12 rounded-xl bg-pm-surface-soft" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-24 rounded bg-pm-surface-soft" />
              <div className="h-12 rounded-xl bg-pm-surface-soft" />
            </div>
          </div>

          {/* Cabin + traveler row */}
          <div className="grid grid-cols-3 gap-4">
            {[3, 3, 2].map((w, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 rounded bg-pm-surface-soft" style={{ width: `${w * 28}px` }} />
                <div className="h-12 rounded-xl bg-pm-surface-soft" />
              </div>
            ))}
          </div>

          {/* CTA button */}
          <div className="h-12 w-40 rounded-full bg-pm-surface-soft" />
        </div>

        {/* Summary panel */}
        <div className="pm-card p-6 space-y-4 h-fit">
          <div className="h-5 w-32 rounded bg-pm-surface-soft" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-4 w-24 rounded bg-pm-surface-soft" />
              <div className="h-4 w-16 rounded bg-pm-surface-soft" />
            </div>
          ))}
          <div className="border-t border-pm-border pt-4">
            <div className="flex justify-between">
              <div className="h-5 w-16 rounded bg-pm-surface-soft" />
              <div className="h-5 w-20 rounded bg-pm-surface-soft" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
