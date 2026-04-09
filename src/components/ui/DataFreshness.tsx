export function DataFreshness({ source }: { source?: string }) {
  return (
    <p className="text-xs text-pm-ink-400">
      {source
        ? `Valuations: ${source}`
        : 'Valuations: TPG April 2026 \u00b7 Updated daily'}
    </p>
  )
}
