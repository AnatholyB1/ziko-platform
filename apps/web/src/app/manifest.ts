import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ziko',
    short_name: 'Ziko',
    description: 'Coach IA, 17 plugins, iOS & Android',
    start_url: '/fr',
    display: 'standalone',
    background_color: '#F7F6F3',
    theme_color: '#FF5C1A',
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
