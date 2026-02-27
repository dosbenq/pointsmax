export default function CalculatorLoading() {
  return (
    <div className="pm-shell py-10 space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded bg-pm-border" />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-pm-border bg-pm-surface p-6 space-y-4">
          <div className="h-4 w-32 rounded bg-pm-surface-soft" />
          <div className="h-10 rounded bg-pm-surface-soft" />
          <div className="h-10 rounded bg-pm-surface-soft" />
          <div className="h-10 rounded bg-pm-surface-soft" />
          <div className="h-10 rounded bg-pm-surface-soft" />
        </div>
        <div className="rounded-2xl border border-pm-border bg-pm-surface p-6 space-y-3">
          <div className="h-4 w-24 rounded bg-pm-surface-soft" />
          <div className="h-24 rounded bg-pm-surface-soft" />
          <div className="h-24 rounded bg-pm-surface-soft" />
        </div>
      </div>
    </div>
  )
}
