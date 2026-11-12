import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, getActionPrimary } from '@ziko/plugin-sdk';

/** Texte orange sur fond clair (5,3:1, contrat de design lot C). */
export const ORANGE_TEXT = '#B53D05';

export const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

export function PrimaryButton({
  label, onPress, disabled, icon,
}: { label: string; onPress: () => void; disabled?: boolean; icon?: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        backgroundColor: getActionPrimary(theme),
        borderRadius: 14,
        minHeight: 52,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {icon ? <Ionicons name={icon as any} size={20} color="#FFFFFF" /> : null}
      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: danger ? '#B3261E' : theme.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Chip({
  label, count, active, onPress,
}: { label: string; count?: number; active: boolean; onPress: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const bg = getActionPrimary(theme);
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      accessibilityState={{ selected: active }}
      style={{
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 22,
        justifyContent: 'center',
        backgroundColor: active ? bg : theme.surface,
        borderWidth: 1,
        borderColor: active ? bg : theme.border,
      }}
    >
      <Text style={{ color: active ? '#FFFFFF' : theme.text, fontSize: 14, fontWeight: '600' }}>
        {label}{count != null ? ` ${count}` : ''}
      </Text>
    </TouchableOpacity>
  );
}

export function Badge({ label, accessibilityLabel }: { label: string; accessibilityLabel?: string }) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={{ backgroundColor: 'rgba(207,69,9,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}
    >
      <Text style={{ color: ORANGE_TEXT, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View
      style={{
        backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
        padding: 20, alignItems: 'center', ...CARD_SHADOW,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={32} color={theme.muted} />
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginTop: 10, textAlign: 'center' }}>
        {message}
      </Text>
      <View style={{ marginTop: 14 }}>
        <SecondaryButton label="Réessayer" onPress={onRetry} />
      </View>
    </View>
  );
}

export function Skeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 8 }} accessibilityLabel="Chargement">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ height: 64, borderRadius: 14, backgroundColor: '#ECEAE4' }} />
      ))}
    </View>
  );
}

export function Stepper({
  value, label, onDec, onInc,
}: { value: string; label: string; onDec: () => void; onInc: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const btn = {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const,
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
  };
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? onInc() : onDec())}
    >
      <TouchableOpacity onPress={onDec} style={btn} accessibilityLabel={`Moins, ${label}`} importantForAccessibility="no">
        <Ionicons name="remove" size={20} color={theme.text} />
      </TouchableOpacity>
      <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700', minWidth: 76, textAlign: 'center' }}>{value}</Text>
      <TouchableOpacity onPress={onInc} style={btn} accessibilityLabel={`Plus, ${label}`} importantForAccessibility="no">
        <Ionicons name="add" size={20} color={theme.text} />
      </TouchableOpacity>
    </View>
  );
}
