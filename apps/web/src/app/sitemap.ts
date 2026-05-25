import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const pages = [
  { path: '', changeFrequency: 'weekly' as const, priority: 1.0 },
  { path: '/mentions-legales', changeFrequency: 'monthly' as const, priority: 0.3 },
  { path: '/politique-de-confidentialite', changeFrequency: 'monthly' as const, priority: 0.3 },
  { path: '/cgu', changeFrequency: 'monthly' as const, priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.flatMap(({ path, changeFrequency, priority }) =>
    routing.locales.map((locale) => ({
      url: `${BASE_URL}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${BASE_URL}/${l}${path}`])
        ),
      },
    }))
  )
}
