import React from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { initials, type LinkedView } from './coachLinked';

const TEAL = '#0F766E';
const TEAL_TINT = '#E1F1EF';

export interface CoachCardStat {
  value: string;
  label: string;
}

export interface CoachCardProps {
  view: LinkedView;
  /** URI deja resolue (logo public ou photo signee) ; null = initiales. */
  avatarUri: string | null;
  stats?: CoachCardStat[];
  /** Couleur de fond du bouton plein (getActionPrimary). */
  actionColor: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** Pied de carte (ex. action de retrait, P25). */
  footer?: React.ReactNode;
}

const CARD = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#E2E0DA',
  padding: 16,
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

/** Carte du coach lie (reutilisable par P25). */
export default function CoachCard({ view, avatarUri, stats = [], actionColor, onRetry, retrying, footer }: CoachCardProps) {
  return (
    <View style={{ gap: 12 }}>
      <View style={CARD}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={{ width: 72, height: 72, borderRadius: 36 }}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : (
            <View
              importantForAccessibility="no"
              style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: TEAL_TINT, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 24, fontWeight: '800', color: TEAL }}>{initials(view.name)}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1C1A17' }}>{view.name}</Text>
            <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 2 }}>
              {view.degraded ? 'Coach lié' : 'Ton coach Ziko'}
            </Text>
            {view.kycVerified ? (
              <View
                accessibilityLabel="Identité vérifiée"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}
              >
                <Ionicons name="shield-checkmark" size={16} color="#15803D" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#15803D' }}>IDENTITÉ VÉRIFIÉE</Text>
              </View>
            ) : view.degraded ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                <Ionicons name="link" size={16} color={TEAL} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: TEAL }}>COACH LIÉ</Text>
              </View>
            ) : null}
          </View>
        </View>

        {view.specialties.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {view.specialties.map((s) => (
              <View
                key={s}
                style={{ paddingHorizontal: 12, minHeight: 32, justifyContent: 'center', borderRadius: 999, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E2E0DA' }}
              >
                <Text style={{ fontSize: 14, color: '#1C1A17' }}>{s}</Text>
              </View>
            ))}
          </View>
        )}

        {view.since && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <Ionicons name="calendar-outline" size={16} color="#6B6963" />
            <Text style={{ fontSize: 14, color: '#6B6963' }}>{`Ton coach depuis le ${view.since}`}</Text>
          </View>
        )}

        {view.degraded && (
          <View
            accessibilityRole="alert"
            style={{ marginTop: 14, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 12, padding: 12, gap: 10 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="warning" size={18} color="#B45309" />
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#92400E' }}>Profil indisponible</Text>
            </View>
            <Text style={{ fontSize: 14, color: '#78350F' }}>
              Le profil de ton coach n'a pas pu être chargé. Ton lien reste actif.
            </Text>
            {onRetry && (
              <TouchableOpacity
                onPress={onRetry}
                disabled={retrying}
                accessibilityRole="button"
                style={{ minHeight: 44, borderRadius: 12, backgroundColor: actionColor, alignItems: 'center', justifyContent: 'center' }}
              >
                {retrying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Réessayer</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {footer}
      </View>

      {stats.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {stats.map((s) => (
            <View key={s.label} style={{ ...CARD, flex: 1, padding: 14 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#1C1A17' }}>{s.value}</Text>
              <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Squelette pendant le chargement (jamais d'ecran vide). */
export function CoachCardSkeleton() {
  const block = (w: number | `${number}%`, h: number, r = 8) => ({ width: w, height: h, borderRadius: r, backgroundColor: '#ECEAE4' });
  return (
    <View accessibilityLabel="Chargement du coach" style={CARD}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={block(72, 72, 36)} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={block('70%', 22)} />
          <View style={block('45%', 14)} />
        </View>
      </View>
      <View style={{ ...block('100%', 14), marginTop: 18 }} />
    </View>
  );
}
