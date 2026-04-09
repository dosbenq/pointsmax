import { Body, Button, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import { EMAIL_THEME } from './theme'

type Props = {
  userEmail: string
  portfolioValue: string
  recommendations: string[]
  calculatorUrl: string
}

export function WelcomeEmail({ userEmail, portfolioValue, recommendations, calculatorUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your PointsMax wallet is ready</Preview>
      <Body style={{ backgroundColor: EMAIL_THEME.colors.background, fontFamily: EMAIL_THEME.fonts.family }}>
        <Container style={{ backgroundColor: EMAIL_THEME.colors.surface, margin: '24px auto', padding: '32px', borderRadius: '16px' }}>
          <Section>
            <Text style={{ fontSize: '28px', fontWeight: 700, color: EMAIL_THEME.colors.text }}>Welcome to PointsMax</Text>
            <Text style={{ color: EMAIL_THEME.colors.textSecondary }}>Signed in as {userEmail}. Your current portfolio value looks like <strong>{portfolioValue}</strong>.</Text>
            {recommendations.map((item) => (
              <Text key={item} style={{ color: EMAIL_THEME.colors.text }}>• {item}</Text>
            ))}
            <Button href={calculatorUrl} style={{ backgroundColor: EMAIL_THEME.colors.text, color: EMAIL_THEME.colors.surface, padding: '12px 18px', borderRadius: '999px', textDecoration: 'none' }}>
              Open calculator
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
