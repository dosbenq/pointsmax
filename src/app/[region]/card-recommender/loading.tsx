export default function CardRecommenderLoading() {
  return (
    <div className="pm-shell py-10 space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-pm-border" />
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
  )
}
