import { MetadataRoute } from 'next'
import { getConfiguredAppOrigin } from '@/lib/app-origin'

const BASE_URL = getConfiguredAppOrigin()

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/auth/',
          '/onboarding/',
          '/profile/',
          '/us/onboarding/',
          '/in/onboarding/',
          '/us/profile/',
          '/in/profile/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
