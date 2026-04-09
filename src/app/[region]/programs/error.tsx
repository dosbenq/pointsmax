'use client'

export default function ProgramsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-pm-bg flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-semibold text-pm-ink-900 mb-4">
          Something went wrong
        </h2>
        <p className="text-pm-ink-500 mb-6">
          We couldn&apos;t load the programs page. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-pm-accent text-white font-medium hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
