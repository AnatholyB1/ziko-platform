import { ImageResponse } from 'next/og'
import { getTranslations } from 'next-intl/server'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Ziko — founder offer'

export async function generateStaticParams() {
  return [{ locale: 'fr' }, { locale: 'en' }]
}

type Props = { params: Promise<{ locale: string }> }

export default async function OpengraphImage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'fondateurs' })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#F7F6F3',
          padding: '80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '48px',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 40,
              fontWeight: 700,
              color: '#FF5C1A',
            }}
          >
            ZIKO
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '9999px',
              backgroundColor: '#FF5C1A',
              color: '#FFFFFF',
              fontSize: 24,
              fontWeight: 700,
              padding: '8px 20px',
            }}
          >
            200
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 56,
            fontWeight: 700,
            color: '#1C1A17',
            lineHeight: 1.15,
            maxWidth: '900px',
          }}
        >
          {t('hero.headline')}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: '32px',
            fontSize: 28,
            color: '#6B6963',
            maxWidth: '820px',
          }}
        >
          {t('counter.preThreshold')}
        </div>
      </div>
    ),
    { ...size },
  )
}
