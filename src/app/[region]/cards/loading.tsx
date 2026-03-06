export default function CardsLoading() {
  return (
    <div className="animate-pulse">
      <div className="pm-page-header">
        <div className="pm-shell space-y-3">
          <div className="h-5 w-20 rounded-full bg-pm-surface-soft" />
          <div className="h-10 w-72 rounded-xl bg-pm-surface-soft" />
          <div className="h-5 w-80 rounded-lg bg-pm-surface-soft" />
        </div>
      </div>
      <div className="pm-shell py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="h-32 rounded-2xl border border-pm-border bg-pm-surface" />
          ))}
        </div>
      </div>
    </div>
  )
}
