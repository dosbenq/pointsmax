import { Body, Button, Container, Head, Html, Preview, Section, Text } from '@react-email/components'

type Props = {
  largestProgram: string
  bestPartner: string
  calculatorUrl: string
}

export function RetentionEmail({ largestProgram, bestPartner, calculatorUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your {largestProgram} points may be more flexible than they look</Preview>
      <Body style={{ backgroundColor: '#f6f8fb', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '24px auto', padding: '32px', borderRadius: '16px' }}>
          <Section>
            <Text style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>A quick wallet reminder</Text>
            <Text style={{ color: '#475569' }}>
              Your largest balance is in <strong>{largestProgram}</strong>. One of the most useful next checks is whether it transfers into <strong>{bestPartner}</strong> for a better redemption.
            </Text>
            <Button href={calculatorUrl} style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 18px', borderRadius: '999px', textDecoration: 'none' }}>
              Re-open your wallet
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
