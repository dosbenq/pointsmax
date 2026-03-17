import { Body, Button, Container, Head, Html, Preview, Section, Text } from '@react-email/components'

type Props = {
  portfolioValue: string
  bonuses: string[]
  featuredRoute: string
  calculatorUrl: string
  unsubscribeUrl: string
}

export function WeeklyDigestEmail({
  portfolioValue,
  bonuses,
  featuredRoute,
  calculatorUrl,
  unsubscribeUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your weekly PointsMax digest</Preview>
      <Body style={{ backgroundColor: '#f6f8fb', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '24px auto', padding: '32px', borderRadius: '16px' }}>
          <Section>
            <Text style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>Your weekly digest</Text>
            <Text style={{ color: '#475569' }}>Current portfolio value: <strong>{portfolioValue}</strong>.</Text>
            <Text style={{ color: '#334155' }}>Featured sweet spot: {featuredRoute}</Text>
            {bonuses.length > 0 ? bonuses.map((bonus) => (
              <Text key={bonus} style={{ color: '#334155' }}>• {bonus}</Text>
            )) : (
              <Text style={{ color: '#64748b' }}>No active transfer bonuses matched your programs this week.</Text>
            )}
            <Button href={calculatorUrl} style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 18px', borderRadius: '999px', textDecoration: 'none' }}>
              Open calculator
            </Button>
            <Text style={{ fontSize: '12px', color: '#94a3b8', marginTop: '24px' }}>
              <a href={unsubscribeUrl}>Unsubscribe from weekly digest emails</a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
