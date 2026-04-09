import { Body, Button, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import { EMAIL_THEME } from './theme'

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
      <Body style={{ backgroundColor: EMAIL_THEME.colors.background, fontFamily: EMAIL_THEME.fonts.family }}>
        <Container style={{ backgroundColor: EMAIL_THEME.colors.surface, margin: '24px auto', padding: '32px', borderRadius: '16px' }}>
          <Section>
            <Text style={{ fontSize: '28px', fontWeight: 700, color: EMAIL_THEME.colors.text }}>A quick wallet reminder</Text>
            <Text style={{ color: EMAIL_THEME.colors.textSecondary }}>
              Your largest balance is in <strong>{largestProgram}</strong>. One of the most useful next checks is whether it transfers into <strong>{bestPartner}</strong> for a better redemption.
            </Text>
            <Button href={calculatorUrl} style={{ backgroundColor: EMAIL_THEME.colors.text, color: EMAIL_THEME.colors.surface, padding: '12px 18px', borderRadius: '999px', textDecoration: 'none' }}>
              Re-open your wallet
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
