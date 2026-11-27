/**
 * PostHog product analytics settings.
 *
 * The project API key (phc_...) is public by design: it ships to every
 * browser and can only send events, never read them. It is kept here so the
 * site works without extra Vercel setup; NEXT_PUBLIC_POSTHOG_KEY overrides it,
 * and setting it to "off" disables analytics (tests, local development).
 * Never put a personal API key (phx_...) here.
 */
const DEFAULT_POSTHOG_KEY = 'phc_xDqZWMVYsS7txso33bR6nxhSsr6DRcUjiycaydDRwgQD'
const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'

function clean(value: string | undefined): string {
  return value?.trim() ?? ''
}

export const POSTHOG_KEY = clean(process.env.NEXT_PUBLIC_POSTHOG_KEY) || DEFAULT_POSTHOG_KEY

/** PostHog ingestion host, e.g. https://us.i.posthog.com (or the EU equivalent). */
export const POSTHOG_HOST = (clean(process.env.NEXT_PUBLIC_POSTHOG_HOST) || DEFAULT_POSTHOG_HOST).replace(/\/+$/, '')

/** Static assets host for the region (session recording, surveys, etc.). */
export const POSTHOG_ASSETS_HOST = POSTHOG_HOST.replace('.i.posthog.com', '-assets.i.posthog.com')

/** PostHog app host, used for links back to the dashboard (toolbar). */
export const POSTHOG_UI_HOST = POSTHOG_HOST.replace('.i.posthog.com', '.posthog.com')

/**
 * Browser events go through our own domain and are rewritten to PostHog in
 * next.config.ts, so ad blockers and the CSP do not drop them.
 */
export const POSTHOG_PROXY_PATH = '/ingest'

export function isPosthogConfigured(): boolean {
  return POSTHOG_KEY.startsWith('phc_')
}
