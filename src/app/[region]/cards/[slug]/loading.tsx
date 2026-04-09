export default function CardDetailLoading() {
  return (
    <div className="min-h-screen bg-pm-bg px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-pm-surface rounded w-1/3" />
          <div className="h-4 bg-pm-surface rounded w-2/3" />
          <div className="h-64 bg-pm-surface rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-pm-surface rounded-xl" />
            <div className="h-24 bg-pm-surface rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
