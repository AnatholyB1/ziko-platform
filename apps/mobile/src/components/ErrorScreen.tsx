import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../stores/themeStore';

// ── Types ──────────────────────────────────────────────────

export type ErrorKind = 'offline' | 'error' | 'empty';

interface VariantData {
  tint: string;
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  sub: string;
  cta: string;
  secondary: string;
}

// ── Variant map ────────────────────────────────────────────

const VARIANTS: Record<ErrorKind, VariantData> = {
  offline: {
    tint: '#E8A33A',
    icon: 'wifi-outline',
    eyebrow: 'Hors-ligne',
    title: 'Pas de connexion',
    sub: 'Vérifie ton réseau. Tes données locales sont préservées et seront synchronisées dès que tu seras de retour.',
    cta: 'Réessayer',
    secondary: 'Mode hors-ligne',
  },
  error: {
    tint: '#E94B3C',
    icon: 'warning-outline',
    eyebrow: 'Oups',
    title: 'Une erreur est survenue',
    sub: "Une erreur inattendue s'est produite. On a déjà reçu le rapport — on regarde ça.",
    cta: "Recharger l'app",
    secondary: 'Signaler',
  },
  empty: {
    tint: '#6B6963',
    icon: 'albums-outline',
    eyebrow: 'Rien ici',
    title: 'Rien ici pour l\'instant',
    sub: 'Commence par ajouter du contenu pour le voir apparaître ici.',
    cta: 'Commencer',
    secondary: 'Retour',
  },
};

// ── Component ──────────────────────────────────────────────

export function ErrorScreen({ kind, onAction }: { kind: ErrorKind; onAction?: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const data = VARIANTS[kind];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Spacer */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 }}>
        {/* Icon badge */}
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 28,
            backgroundColor: data.tint + '24',
            borderWidth: 1.5,
            borderColor: data.tint + '40',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={data.icon} size={42} color={data.tint} />
        </View>

        {/* Eyebrow */}
        <Text style={{ fontSize: 11, fontWeight: '800', color: data.tint, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 6 }}>
          {data.eyebrow}
        </Text>

        {/* Title */}
        <Text style={{ fontSize: 26, fontWeight: '800', color: theme.text, lineHeight: 30, letterSpacing: -0.3, textAlign: 'center' }}>
          {data.title}
        </Text>

        {/* Body */}
        <Text style={{ fontSize: 13.5, color: theme.muted, lineHeight: 21, textAlign: 'center', maxWidth: 320 }}>
          {data.sub}
        </Text>
      </View>

      {/* CTAs */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32, gap: 10 }}>
        <TouchableOpacity
          onPress={onAction}
          style={{ padding: 14, borderRadius: 14, backgroundColor: theme.text, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{data.cta}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onAction}
          style={{ padding: 12, borderRadius: 14, backgroundColor: theme.text + '0D', alignItems: 'center' }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{data.secondary}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
