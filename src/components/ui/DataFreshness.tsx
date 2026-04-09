export function DataFreshness({ source = 'TPG April 2026' }: { source?: string }) {
  return (
    <p className="text-xs text-pm-ink-400 flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
      Valuations: {source}
    </p>
  )
}
