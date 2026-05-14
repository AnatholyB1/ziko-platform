import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#FFFFFF',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: '#FF5C1A', fontSize: 120, fontWeight: 700, lineHeight: 1 }}>
          Z
        </span>
      </div>
    ),
    { ...size }
  )
}
