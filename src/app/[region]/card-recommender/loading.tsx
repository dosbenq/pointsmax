export default function CardRecommenderLoading() {
  return (
    <div className="animate-pulse">
      <div className="pm-page-header">
        <div className="pm-shell space-y-3">
          <div className="h-5 w-32 rounded-full bg-pm-surface-soft" />
          <div className="h-10 w-72 rounded-xl bg-pm-surface-soft" />
          <div className="h-5 w-80 rounded-lg bg-pm-surface-soft" />
        </div>
      </div>
      <div className="pm-shell py-8">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-pm-border bg-pm-surface p-6 space-y-3">
            <div className="h-10 rounded bg-pm-surface-soft" />
            <div className="h-10 rounded bg-pm-surface-soft" />
            <div className="h-10 rounded bg-pm-surface-soft" />
            <div className="h-10 rounded bg-pm-surface-soft" />
          </div>
          <div className="space-y-3">
            <div className="h-28 rounded-2xl border border-pm-border bg-pm-surface" />
            <div className="h-28 rounded-2xl border border-pm-border bg-pm-surface" />
            <div className="h-28 rounded-2xl border border-pm-border bg-pm-surface" />
            <div className="h-28 rounded-2xl border border-pm-border bg-pm-surface" />
          </div>
        </div>
      </div>
    </div>
  )
}
