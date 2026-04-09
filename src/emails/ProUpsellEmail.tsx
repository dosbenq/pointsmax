import { Body, Button, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import { EMAIL_THEME } from './theme'

type Props = {
  homeAirport: string
  pricingUrl: string
}

export function ProUpsellEmail({ homeAirport, pricingUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Unlock live award availability for {homeAirport}</Preview>
      <Body style={{ backgroundColor: EMAIL_THEME.colors.background, fontFamily: EMAIL_THEME.fonts.family }}>
        <Container style={{ backgroundColor: EMAIL_THEME.colors.surface, margin: '24px auto', padding: '32px', borderRadius: '16px' }}>
          <Section>
            <Text style={{ fontSize: '28px', fontWeight: 700, color: EMAIL_THEME.colors.text }}>Go beyond estimates</Text>
            <Text style={{ color: EMAIL_THEME.colors.textSecondary }}>
              Premium unlocks live Seats.aero availability, wallet sync, and flight-watch automation from your home market around <strong>{homeAirport}</strong>.
            </Text>
            <Button href={pricingUrl} style={{ backgroundColor: EMAIL_THEME.colors.text, color: EMAIL_THEME.colors.surface, padding: '12px 18px', borderRadius: '999px', textDecoration: 'none' }}>
              View Premium
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
