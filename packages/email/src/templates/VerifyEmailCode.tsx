// VerifyEmailCode.tsx — French email carrying the 6-digit code that proves ownership of an
// email address (application-level verification, no link on purpose: the code is typed in the app).
import React from 'react';
import { Html, Body, Head, Preview, Container, Section, Text } from '@react-email/components';

export interface VerifyEmailCodeProps {
  code: string; // 6 digits
  firstName?: string;
  expiresInMinutes?: number;
}

const body: React.CSSProperties = { fontSize: '14px', color: '#1C1A17', margin: '0 0 12px 0' };

function VerifyEmailCode({
  code,
  firstName,
  expiresInMinutes = 10,
}: VerifyEmailCodeProps): React.ReactElement {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Ton code de confirmation Ziko : ${code}`}</Preview>
      <Body
        style={{
          backgroundColor: '#F7F6F3',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          margin: 0,
          padding: 0,
        }}
      >
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
          <Section style={{ padding: '0 0 8px 0' }}>
            <Text
              style={{
                fontSize: '28px',
                fontWeight: 600,
                color: '#FF5C1A',
                margin: 0,
                letterSpacing: '-0.5px',
              }}
            >
              ZIKO
            </Text>
          </Section>

          <Section
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E0DA',
              borderRadius: '12px',
              padding: '32px',
            }}
          >
            <Text style={{ fontSize: '18px', fontWeight: 600, color: '#1C1A17', margin: '0 0 16px 0' }}>
              Confirme ton adresse email
            </Text>
            <Text style={body}>{firstName ? `Bonjour ${firstName},` : 'Bonjour,'}</Text>
            <Text style={body}>Saisis ce code dans l&apos;application Ziko pour confirmer ton adresse :</Text>
            <Text
              style={{
                fontSize: '32px',
                fontWeight: 700,
                letterSpacing: '8px',
                color: '#1C1A17',
                backgroundColor: '#F7F6F3',
                border: '1px solid #E2E0DA',
                borderRadius: '12px',
                textAlign: 'center',
                padding: '16px',
                margin: '8px 0 16px 0',
              }}
            >
              {code}
            </Text>
            <Text style={body}>Ce code expire dans {expiresInMinutes} minutes.</Text>
            <Text style={{ ...body, color: '#6B6963' }}>
              Si tu n&apos;es pas à l&apos;origine de cette demande, ignore simplement cet email.
            </Text>
          </Section>

          <Text
            style={{
              fontSize: '12px',
              color: '#6B6963',
              textAlign: 'center',
              padding: '16px',
              margin: 0,
            }}
          >
            Ziko
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export { VerifyEmailCode };
export default VerifyEmailCode;
