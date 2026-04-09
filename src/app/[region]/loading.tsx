export default function RegionLoading() {
  return (
    <div className="min-h-screen bg-pm-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-pm-accent/30 border-t-pm-accent rounded-full animate-spin" />
        <p className="text-sm text-pm-ink-500">Loading...</p>
      </div>
    </div>
  )
}
