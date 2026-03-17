import { Body, Button, Container, Head, Html, Preview, Section, Text } from '@react-email/components'

type Props = {
  homeAirport: string
  pricingUrl: string
}

export function ProUpsellEmail({ homeAirport, pricingUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Unlock live award availability for {homeAirport}</Preview>
      <Body style={{ backgroundColor: '#f6f8fb', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '24px auto', padding: '32px', borderRadius: '16px' }}>
          <Section>
            <Text style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>Go beyond estimates</Text>
            <Text style={{ color: '#475569' }}>
              Premium unlocks live Seats.aero availability, wallet sync, and flight-watch automation from your home market around <strong>{homeAirport}</strong>.
            </Text>
            <Button href={pricingUrl} style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 18px', borderRadius: '999px', textDecoration: 'none' }}>
              View Premium
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
