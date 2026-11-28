import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import { POSTHOG_ASSETS_HOST, POSTHOG_HOST, POSTHOG_PROXY_PATH } from './src/config/analytics'

const isProd = process.env.NODE_ENV === 'production'
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com https://seats.aero https://*.ingest.sentry.io https://us.i.posthog.com https://*.posthog.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  // ISR pages for cards/programs are revalidated by cron via revalidateTag/revalidatePath.
  turbopack: {
    root: __dirname,
  },
  images: {
    // No remote images: card art is self-hosted. (Allowing every host made
    // /_next/image an open proxy for anyone's images, billed to this project.)
    minimumCacheTTL: 86400,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // PostHog's API paths end in a slash; don't redirect them.
  skipTrailingSlashRedirect: true,
  async redirects() {
    // Pages removed in the redesign: send old links and search results to the
    // region home rather than a 404.
    // The search now lives on the region home (/us, /in).
    const removed = [
      'cards', 'programs', 'card-recommender', 'earning-calculator', 'hotel-search', 'how-it-works',
      'calculator', 'award-search', 'onboarding',
    ]
    return [
      ...removed.flatMap((page) => [
        { source: `/:region(us|in)/${page}`, destination: '/:region', permanent: true },
        { source: `/:region(us|in)/${page}/:path*`, destination: '/:region', permanent: true },
        { source: `/${page}`, destination: '/', permanent: true },
      ]),
      // Paused until watches and alerts work (temporary, it will return).
      { source: '/:region(us|in)/pricing', destination: '/:region', permanent: false },
      { source: '/pricing', destination: '/', permanent: false },
    ]
  },
  async rewrites() {
    // Serve PostHog from our own domain so ad blockers don't drop analytics.
    return [
      { source: `${POSTHOG_PROXY_PATH}/static/:path*`, destination: `${POSTHOG_ASSETS_HOST}/static/:path*` },
      { source: `${POSTHOG_PROXY_PATH}/:path*`, destination: `${POSTHOG_HOST}/:path*` },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(isProd
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
            : []),
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
})
