import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-pm-bg flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-pm-accent mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-pm-ink-900 mb-4">
          Page not found
        </h2>
        <p className="text-pm-ink-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/us"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-pm-accent text-white font-medium hover:opacity-90 transition-opacity"
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  )
}
