// ReloginNotice.tsx — bilingual (FR primary, EN second) notice sent to Ziko users
// before the Supabase portfolio cutover: sessions are invalidated, users sign in again.
// Dates arrive pre-formatted so the template does no locale logic. No links on purpose.
import React from 'react';
import { Html, Body, Head, Preview, Container, Section, Text, Hr } from '@react-email/components';

export interface ReloginNoticeProps {
  cutoverDateFr: string; // e.g. "15 novembre 2026"
  cutoverDateEn: string; // e.g. "November 15, 2026"
  firstName?: string;
}

const heading: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 600,
  color: '#1C1A17',
  margin: '0 0 16px 0',
};
const body: React.CSSProperties = { fontSize: '14px', color: '#1C1A17', margin: '0 0 12px 0' };

function ReloginNotice({
  cutoverDateFr,
  cutoverDateEn,
  firstName,
}: ReloginNoticeProps): React.ReactElement {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Ziko change d'infrastructure le ${cutoverDateFr} : reconnexion nécessaire`}</Preview>
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
            {/* Français */}
            <Text style={heading}>Ziko change d&apos;infrastructure le {cutoverDateFr}</Text>
            <Text style={body}>{firstName ? `Bonjour ${firstName},` : 'Bonjour,'}</Text>
            <Text style={body}>
              Le {cutoverDateFr}, vous devrez vous reconnecter une fois avec la même adresse e-mail
              et le même mot de passe.
            </Text>
            <Text style={body}>Aucune donnée n&apos;est perdue.</Text>
            <Text style={body}>
              Mettez à jour l&apos;application mobile depuis le store dès que la nouvelle version
              est disponible.
            </Text>
            <Text style={body}>
              Si la connexion échoue, utilisez « Mot de passe oublié » sur l&apos;écran de
              connexion.
            </Text>

            <Hr style={{ borderColor: '#E2E0DA', margin: '24px 0' }} />

            {/* English */}
            <Text style={heading}>Ziko is moving to new infrastructure on {cutoverDateEn}</Text>
            <Text style={body}>{firstName ? `Hello ${firstName},` : 'Hello,'}</Text>
            <Text style={body}>
              On {cutoverDateEn}, you will need to sign in again once, using the same email and
              password.
            </Text>
            <Text style={body}>No data is lost.</Text>
            <Text style={body}>
              Please update the mobile app from the store as soon as the new version is available.
            </Text>
            <Text style={body}>
              If sign-in fails, use &quot;Forgot password&quot; on the sign-in screen.
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

export { ReloginNotice };
export default ReloginNotice;
