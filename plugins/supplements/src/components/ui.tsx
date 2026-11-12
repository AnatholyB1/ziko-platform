import React from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, getActionPrimary } from '@ziko/plugin-sdk';

/** Texte d'accent (dose, moment, prix) : #B53D05, AA sur fond clair (contrat lot C). */
export const ACCENT_TEXT = '#B53D05';

export const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View
      style={[
        {
          ...CARD_SHADOW,
          backgroundColor: theme.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Bouton plein : fond actionPrimary (#CF4509), texte blanc (4,66:1). */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  const off = disabled || loading;
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off }}
      onPress={off ? undefined : onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: getActionPrimary(theme),
        opacity: off ? 0.5 : 1,
        borderRadius: 14,
        minHeight: 48,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : null}
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({
  label,
  onPress,
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 14,
        minHeight: 48,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {icon ? <Ionicons name={icon} size={18} color={theme.text} /> : null}
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Puce selectionnable (multi-choix). Etat actif : fond actionPrimary + texte blanc. */
export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        minHeight: 40,
        paddingHorizontal: 16,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? getActionPrimary(theme) : theme.surface,
        borderWidth: 1,
        borderColor: selected ? getActionPrimary(theme) : theme.border,
      }}
    >
      <Text style={{ color: selected ? '#FFFFFF' : theme.text, fontSize: 13.5, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Feuille modale ancree en bas. */
export function BottomSheet({
  visible,
  onClose,
  title,
  right,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(28,26,23,0.4)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 18,
            paddingBottom: 28,
            maxHeight: '88%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ flex: 1, color: theme.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
            {right}
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              style={{ marginLeft: 12, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={22} color={theme.muted} />
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Stepper - / valeur / + (dose, heure). */
export function Stepper({
  valueLabel,
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
  testID,
}: {
  valueLabel: string;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel: string;
  plusLabel: string;
  testID?: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  const btn = {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <TouchableOpacity onPress={onMinus} accessibilityRole="button" accessibilityLabel={minusLabel} style={btn}>
        <Ionicons name="remove" size={20} color={theme.text} />
      </TouchableOpacity>
      <Text style={{ minWidth: 84, textAlign: 'center', color: theme.text, fontSize: 17, fontWeight: '800' }}>{valueLabel}</Text>
      <TouchableOpacity onPress={onPlus} accessibilityRole="button" accessibilityLabel={plusLabel} style={btn}>
        <Ionicons name="add" size={20} color={theme.text} />
      </TouchableOpacity>
    </View>
  );
}

export function EmptyBlock({
  icon,
  title,
  message,
  ctaLabel,
  onCta,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 12 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Ionicons name={icon} size={30} color={theme.muted} />
      </View>
      <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: theme.muted, fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 6, marginBottom: ctaLabel ? 18 : 0 }}>
        {message}
      </Text>
      {ctaLabel && onCta ? <PrimaryButton label={ctaLabel} onPress={onCta} /> : null}
    </View>
  );
}

/** Tuile "Visuel" en pointilles quand il n'y a pas d'image (aucune photo inventee). */
export function VisualTile({ size = 56 }: { size?: number }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: theme.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: theme.muted, fontSize: 10.5, fontWeight: '600' }}>Visuel</Text>
    </View>
  );
}
