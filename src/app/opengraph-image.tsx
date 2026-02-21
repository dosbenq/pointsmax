import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'PointsMax — Maximize Your Loyalty Points'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif',
          padding: '80px',
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 600,
            color: '#0f172a',
            letterSpacing: '-1px',
            marginBottom: 16,
          }}
        >
          PointsMax
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            color: '#64748b',
            marginBottom: 56,
            letterSpacing: '-0.3px',
          }}
        >
          Your points are worth more than you think.
        </div>

        {/* Sample result card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #e2e8f0',
            borderRadius: 20,
            overflow: 'hidden',
            width: 440,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 28px',
              background: 'white',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <span style={{ color: '#64748b', fontSize: 17 }}>Cash value</span>
            <span style={{ color: '#0f172a', fontWeight: 600, fontSize: 17 }}>$800</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 28px',
              background: '#0f172a',
            }}
          >
            <span style={{ color: 'white', fontSize: 17 }}>Best value</span>
            <span style={{ color: 'white', fontWeight: 600, fontSize: 17 }}>$2,000</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 28px',
              background: 'white',
            }}
          >
            <span style={{ color: '#64748b', fontSize: 17 }}>Extra value</span>
            <span style={{ color: '#059669', fontWeight: 600, fontSize: 17 }}>+$1,200</span>
          </div>
        </div>

        {/* Supporting labels */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginTop: 48,
            color: '#94a3b8',
            fontSize: 16,
          }}
        >
          <span>20+ programs</span>
          <span>·</span>
          <span>AI-powered</span>
          <span>·</span>
          <span>Free forever</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
