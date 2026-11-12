import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, getActionPrimary } from '@ziko/plugin-sdk';

// Petites briques partagees du Garde-manger (styles inline, charte v1.20).

export const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
} as const;

export function useCardStyle() {
  const theme = useThemeStore((s) => s.theme);
  return {
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    ...CARD_SHADOW,
  } as const;
}

/** Bouton plein : fond `actionPrimary` (#CF4509, blanc dessus >= 4.5:1), hauteur 48. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel?: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      activeOpacity={0.85}
      style={{
        minHeight: 48,
        borderRadius: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: disabled ? theme.border : getActionPrimary(theme),
      }}
    >
      {icon ? <Ionicons name={icon} size={18} color={disabled ? theme.muted : '#FFFFFF'} /> : null}
      <Text style={{ fontSize: 15, fontWeight: '700', color: disabled ? theme.muted : '#FFFFFF', flexShrink: 1, textAlign: 'center' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({
  label,
  onPress,
  icon,
  danger,
  flex,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  danger?: boolean;
  flex?: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  const color = danger ? '#B5301F' : theme.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.85}
      style={{
        minHeight: 48,
        borderRadius: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        ...(flex ? { flex: 1 } : null),
      }}
    >
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <Text style={{ fontSize: 15, fontWeight: '600', color, flexShrink: 1, textAlign: 'center' }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Puce tactile 44 dp ; l'etat selectionne n'est jamais porte par la couleur seule (bord + gras + accessibilityState). */
export function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      activeOpacity={0.85}
      style={{
        minHeight: 44,
        borderRadius: 22,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.primary : theme.border,
        backgroundColor: selected ? theme.primarySubtle : theme.surface,
        marginRight: 8,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: selected ? '700' : '500', color: theme.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

export type BadgeTone = 'danger' | 'warning' | 'ok';

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  danger: { bg: '#FBE9E7', fg: '#B5301F' },
  warning: { bg: '#FDF3DC', fg: '#8A5700' },
  ok: { bg: '#F0EFE9', fg: '#6B6963' },
};

/** Badge de statut : toujours un libelle (12 sp), la couleur n'est qu'un renfort. */
export function TextBadge({ text, tone }: { text: string; tone: BadgeTone }) {
  const c = TONES[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: c.fg }}>{text}</Text>
    </View>
  );
}

/** Carte d'etat vide / erreur. */
export function StateCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  const theme = useThemeStore((s) => s.theme);
  const card = useCardStyle();
  return (
    <View style={{ ...card, padding: 24, alignItems: 'center', gap: 12, marginTop: 8 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.primarySubtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={26} color={theme.primary} />
      </View>
      <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '700', color: theme.text, textAlign: 'center' }}>
        {title}
      </Text>
      {body ? <Text style={{ fontSize: 14, color: theme.muted, textAlign: 'center', lineHeight: 20 }}>{body}</Text> : null}
      {children ? <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 4 }}>{children}</View> : null}
    </View>
  );
}
