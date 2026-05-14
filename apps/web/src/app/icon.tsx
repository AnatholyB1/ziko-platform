import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
        <span style={{ color: '#FF5C1A', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
          Z
        </span>
      </div>
    ),
    { ...size }
  )
}
