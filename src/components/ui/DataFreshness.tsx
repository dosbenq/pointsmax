export function DataFreshness({ source }: { source?: string }) {
  return (
    <p className="text-xs text-pm-ink-400 flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-pm-ink-300 inline-block" />
      {source ?? 'Point values are estimates'}
    </p>
  )
}
