export default function ProgramDetailLoading() {
  return (
    <div className="min-h-screen bg-pm-bg">
      <div className="pm-shell py-12 space-y-8">
        {/* Header skeleton */}
        <div className="space-y-3">
          <div className="h-8 w-64 bg-pm-surface-soft rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-pm-surface-soft rounded animate-pulse" />
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="pm-card p-6 space-y-4">
            <div className="h-5 w-32 bg-pm-surface-soft rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-pm-surface-soft rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-pm-surface-soft rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-pm-surface-soft rounded animate-pulse" />
            </div>
          </div>
          <div className="pm-card p-6 space-y-4">
            <div className="h-5 w-40 bg-pm-surface-soft rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-pm-surface-soft rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-pm-surface-soft rounded animate-pulse" />
              <div className="h-4 w-4/5 bg-pm-surface-soft rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
