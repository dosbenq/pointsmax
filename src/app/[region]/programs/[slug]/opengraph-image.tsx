import { ImageResponse } from 'next/og'
import { getProgramBySlug } from '@/lib/programmatic-content'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

type Props = {
  params: Promise<{ region: string; slug: string }>
}

export default async function Image({ params }: Props) {
  const { region, slug } = await params
  const normalized = region === 'in' ? 'in' : 'us'
  const program = await getProgramBySlug(normalized, slug)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
          background: 'linear-gradient(135deg, #1f2937 0%, #102c4a 50%, #124f63 100%)',
          color: '#f8fafc',
          fontFamily: 'Inter, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              padding: '10px 16px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.1)',
              fontSize: 24,
            }}
          >
            PointsMax program guide
          </div>
          <div style={{ fontSize: 24, opacity: 0.85 }}>{normalized.toUpperCase()}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.05 }}>
            {program?.name ?? 'Rewards Program'}
          </div>
          <div style={{ fontSize: 32, opacity: 0.9 }}>
            {program ? `${program.transfer_out.length} transfer partners and ${program.earning_cards.length} mapped earning cards` : 'Transfer value and partner intelligence'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '18px 22px', background: 'rgba(255,255,255,0.08)', borderRadius: 24 }}>
            <div style={{ fontSize: 18, opacity: 0.75 }}>Current value</div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>{program ? `${program.cpp_cents.toFixed(2)}¢/pt` : 'PointsMax'}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '18px 22px', background: 'rgba(255,255,255,0.08)', borderRadius: 24 }}>
            <div style={{ fontSize: 18, opacity: 0.75 }}>Best uses</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {program?.best_uses[0] ?? 'Premium travel and partner transfers'}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
