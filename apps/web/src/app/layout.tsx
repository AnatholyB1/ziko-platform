import type { Metadata, Viewport } from 'next'
import Script from 'next/script'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const viewport: Viewport = {
  themeColor: '#FF5C1A',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s | Ziko',
    default: 'Ziko — L\'appli fitness tout-en-un',
  },
  applicationName: 'Ziko',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Ziko',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        {/* Privacy-friendly analytics by Plausible */}
        <Script
          async
          src="https://plausible.io/js/pa-rJuI-Kc3gPygcauGKG7eV.js"
          strategy="afterInteractive"
        />
        <Script
          id="plausible-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`,
          }}
        />
      </body>
    </html>
  )
}
