import { Body, Button, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import { EMAIL_THEME } from './theme'

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
      <Body style={{ backgroundColor: EMAIL_THEME.colors.background, fontFamily: EMAIL_THEME.fonts.family }}>
        <Container style={{ backgroundColor: EMAIL_THEME.colors.surface, margin: '24px auto', padding: '32px', borderRadius: '16px' }}>
          <Section>
            <Text style={{ fontSize: '28px', fontWeight: 700, color: EMAIL_THEME.colors.text }}>Your weekly digest</Text>
            <Text style={{ color: EMAIL_THEME.colors.textSecondary }}>Current portfolio value: <strong>{portfolioValue}</strong>.</Text>
            <Text style={{ color: EMAIL_THEME.colors.text }}>Featured sweet spot: {featuredRoute}</Text>
            {bonuses.length > 0 ? bonuses.map((bonus) => (
              <Text key={bonus} style={{ color: EMAIL_THEME.colors.text }}>• {bonus}</Text>
            )) : (
              <Text style={{ color: EMAIL_THEME.colors.textSecondary }}>No active transfer bonuses matched your programs this week.</Text>
            )}
            <Button href={calculatorUrl} style={{ backgroundColor: EMAIL_THEME.colors.text, color: EMAIL_THEME.colors.surface, padding: '12px 18px', borderRadius: '999px', textDecoration: 'none' }}>
              Open calculator
            </Button>
            <Text style={{ fontSize: '12px', color: EMAIL_THEME.colors.textSecondary, marginTop: '24px' }}>
              <a href={unsubscribeUrl}>Unsubscribe from weekly digest emails</a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
