import Link from 'next/link'

export default function RegionNotFound() {
  return (
    <div className="min-h-screen bg-pm-bg flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-pm-accent mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-pm-ink-900 mb-4">
          Page not found
        </h2>
        <p className="text-pm-ink-500 mb-8">
          This page doesn&apos;t exist. Try one of our main tools below.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/us/calculator"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-pm-accent text-white font-medium hover:opacity-90 transition-opacity"
          >
            Calculator
          </Link>
          <Link
            href="/us/award-search"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-pm-border text-pm-ink-700 font-medium hover:bg-pm-surface transition-colors"
          >
            Award Search
          </Link>
        </div>
      </div>
    </div>
  )
}
