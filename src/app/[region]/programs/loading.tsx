export default function ProgramsLoading() {
  return (
    <div className="animate-pulse">
      <div className="pm-page-header">
        <div className="pm-shell space-y-3">
          <div className="h-5 w-28 rounded-full bg-pm-surface-soft" />
          <div className="h-10 w-72 rounded-xl bg-pm-surface-soft" />
          <div className="h-5 w-96 rounded-lg bg-pm-surface-soft" />
        </div>
      </div>
      <div className="pm-shell py-8">
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-20 rounded-2xl border border-pm-border bg-pm-surface" />
          ))}
        </div>
      </div>
    </div>
  )
}
