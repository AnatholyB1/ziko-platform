// WeeklyDigest.tsx — React Email template for Monday coach weekly digest.
// Rendered to HTML string via render() from @react-email/components in backend/api.
import React from 'react';
import {
  Html,
  Body,
  Head,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Link,
} from '@react-email/components';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AlertClient {
  name: string;
  severity: 'high' | 'medium' | 'low';
  summary: string;
  clientId: string;
}

export interface WeeklyDigestProps {
  coachName: string;
  weekLabel: string; // e.g. "19 au 25 mai 2026"
  alertClients: AlertClient[];
  okClientNames: string[]; // clients with no alerts
  dashboardUrl: string; // e.g. "https://ziko-app.com/fr/coach/dashboard"
}

// ─── Severity badge helpers ───────────────────────────────────────────────────

const SEVERITY_STYLE: Record<AlertClient['severity'], React.CSSProperties> = {
  high: { backgroundColor: '#FEF2F2', color: '#EF4444' },
  medium: { backgroundColor: '#FFFBEB', color: '#F59E0B' },
  low: { backgroundColor: '#F0FDF4', color: '#16A34A' },
};

const SEVERITY_LABEL: Record<AlertClient['severity'], string> = {
  high: 'PRIORITE HAUTE',
  medium: 'A SURVEILLER',
  low: 'A NOTER',
};

// ─── Component ────────────────────────────────────────────────────────────────

function WeeklyDigest({
  coachName,
  weekLabel,
  alertClients,
  okClientNames,
  dashboardUrl,
}: WeeklyDigestProps): React.ReactElement {
  const alertCount = alertClients.length;

  return (
    <Html lang="fr">
      <Head />
      <Body
        style={{
          backgroundColor: '#F7F6F3',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          margin: 0,
          padding: 0,
        }}
      >
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
          {/* Logo */}
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

          {/* Main card */}
          <Section
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '32px',
              marginBottom: '8px',
            }}
          >
            {/* Title */}
            <Text
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#1C1A17',
                margin: '0 0 4px 0',
              }}
            >
              Votre resume hebdomadaire
            </Text>
            <Text
              style={{
                fontSize: '12px',
                color: '#6B6963',
                margin: '0 0 24px 0',
              }}
            >
              Semaine du {weekLabel}
            </Text>

            {/* Greeting */}
            <Text style={{ fontSize: '14px', color: '#1C1A17', margin: '0 0 4px 0' }}>
              Bonjour {coachName},
            </Text>
            <Text style={{ fontSize: '14px', color: '#1C1A17', margin: '0 0 24px 0' }}>
              Voici les points cles de vos clients cette semaine.
            </Text>

            {/* Alert clients section */}
            {alertClients.length > 0 && (
              <>
                <Text
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1C1A17',
                    margin: '0 0 12px 0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {alertCount} client{alertCount > 1 ? 's' : ''} a surveiller
                </Text>

                {alertClients.map((client) => (
                  <Section
                    key={client.clientId}
                    style={{
                      backgroundColor: '#F7F6F3',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '8px',
                    }}
                  >
                    {/* Severity badge */}
                    <Text
                      style={{
                        ...SEVERITY_STYLE[client.severity],
                        fontSize: '11px',
                        fontWeight: 600,
                        margin: '0 0 6px 0',
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {SEVERITY_LABEL[client.severity]}
                    </Text>

                    {/* Client name */}
                    <Text
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1C1A17',
                        margin: '0 0 4px 0',
                      }}
                    >
                      {client.name}
                    </Text>

                    {/* Summary */}
                    <Text
                      style={{
                        fontSize: '13px',
                        color: '#6B6963',
                        margin: '0 0 8px 0',
                      }}
                    >
                      {client.summary}
                    </Text>

                    {/* Deep link */}
                    <Link
                      href={`${dashboardUrl}?client=${client.clientId}`}
                      style={{
                        fontSize: '13px',
                        color: '#FF5C1A',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      Analyser {client.name} &rarr;
                    </Link>
                  </Section>
                ))}
              </>
            )}

            {/* OK clients section */}
            {okClientNames.length > 0 && (
              <>
                <Text
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1C1A17',
                    margin: alertClients.length > 0 ? '16px 0 8px 0' : '0 0 8px 0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {okClientNames.length} client{okClientNames.length > 1 ? 's' : ''} en bonne forme
                </Text>
                <Section
                  style={{
                    backgroundColor: '#F0FDF4',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '8px',
                  }}
                >
                  <Text style={{ fontSize: '13px', color: '#6B6963', margin: 0 }}>
                    {okClientNames.join(', ')} — RAS
                  </Text>
                </Section>
              </>
            )}

            <Hr style={{ borderColor: '#E2E0DA', margin: '24px 0' }} />

            {/* CTA button */}
            <Button
              href={dashboardUrl}
              style={{
                backgroundColor: '#FF5C1A',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                padding: '8px 24px',
                borderRadius: '8px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Ouvrir le tableau de bord &rarr;
            </Button>
          </Section>

          {/* Footer */}
          <Text
            style={{
              fontSize: '12px',
              color: '#6B6963',
              textAlign: 'center',
              padding: '16px',
              margin: 0,
            }}
          >
            Cet email est genere automatiquement par Ziko IA.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export { WeeklyDigest };
