import { ImageResponse } from 'next/og'
import { getActiveCards, normalizeGeography } from '@/lib/db/cards'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

type Props = {
  params: Promise<{ region: string; slug: string }>
}

function formatFee(amount: number, currency: string): string {
  if (amount === 0) return 'No annual fee'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'INR' ? 'INR' : 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function Image({ params }: Props) {
  const { region, slug } = await params
  const cards = await getActiveCards(normalizeGeography(region))
  const card = cards.find((entry) => entry.program_slug === slug || entry.id === slug)

  const title = card?.name ?? 'PointsMax Card Review'
  const issuer = card?.issuer ?? 'PointsMax'
  const bestRate = card
    ? Object.entries(card.earning_rates).sort(([, left], [, right]) => right - left)[0]
    : null

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
          background: 'linear-gradient(135deg, #0f172a 0%, #12324b 55%, #1b6b7d 100%)',
          color: '#f8fafc',
          fontFamily: 'Inter, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div
            style={{
              display: 'flex',
              padding: '10px 16px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.1)',
              fontSize: 24,
            }}
          >
            PointsMax card review
          </div>
          <div style={{ fontSize: 24, opacity: 0.85 }}>{issuer}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
          <div style={{ fontSize: 30, opacity: 0.9 }}>
            {bestRate ? `${bestRate[1]}x on ${bestRate[0]}` : 'Rewards profile available on PointsMax'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '18px 22px', background: 'rgba(255,255,255,0.08)', borderRadius: 24 }}>
            <div style={{ fontSize: 18, opacity: 0.75 }}>Annual fee</div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>{card ? formatFee(card.annual_fee_usd, card.currency) : 'Review'}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '18px 22px', background: 'rgba(255,255,255,0.08)', borderRadius: 24 }}>
            <div style={{ fontSize: 18, opacity: 0.75 }}>Point value</div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>{card ? `${card.cpp_cents.toFixed(2)}¢/pt` : 'PointsMax'}</div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
