import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getActionPrimary } from '@ziko/plugin-sdk';

export const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

/** Puce selectionnee = fond d'action (blanc dessus AA), sinon surface + bord. */
export function getChipColors(theme: any, on: boolean) {
  return on
    ? { bg: getActionPrimary(theme), border: getActionPrimary(theme), text: '#FFFFFF' }
    : { bg: theme.surface, border: theme.border, text: theme.text };
}

export function Card({ theme, children, style }: { theme: any; children: React.ReactNode; style?: any }) {
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        ...CARD_SHADOW,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

/** Bouton plein a texte blanc : fond = getActionPrimary (#CF4509, AA 4,66:1). */
export function PrimaryButton({
  theme, label, icon, onPress, disabled, style,
}: { theme: any; label: string; icon?: any; onPress: () => void; disabled?: boolean; style?: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        minHeight: 48,
        borderRadius: 14,
        paddingHorizontal: 20,
        backgroundColor: disabled ? theme.border : getActionPrimary(theme),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...style,
      }}
    >
      {icon ? <Ionicons name={icon} size={18} color={disabled ? theme.muted : '#FFFFFF'} /> : null}
      <Text style={{ color: disabled ? theme.muted : '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({
  theme, label, icon, onPress, style,
}: { theme: any; label: string; icon?: any; onPress: () => void; style?: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: 48,
        borderRadius: 14,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...style,
      }}
    >
      {icon ? <Ionicons name={icon} size={18} color={theme.text} /> : null}
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Stepper (boutons 44x44), expose comme `adjustable` pour les lecteurs d'ecran. */
export function Stepper({
  theme, label, valueText, onInc, onDec, invalid, a11yValue,
}: {
  theme: any; label: string; valueText: string; onInc: () => void; onDec: () => void; invalid?: boolean; a11yValue?: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: a11yValue ?? valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') onInc();
        if (e.nativeEvent.actionName === 'decrement') onDec();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: invalid ? theme.danger : theme.border,
        backgroundColor: theme.surface,
      }}
    >
      <TouchableOpacity
        onPress={onDec}
        accessible={false}
        importantForAccessibility="no"
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="remove" size={20} color={theme.text} />
      </TouchableOpacity>
      <Text style={{ minWidth: 72, textAlign: 'center', fontSize: 17, fontWeight: '700', color: theme.text }}>{valueText}</Text>
      <TouchableOpacity
        onPress={onInc}
        accessible={false}
        importantForAccessibility="no"
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="add" size={20} color={theme.text} />
      </TouchableOpacity>
    </View>
  );
}

/** Interrupteur 52x32 dans une zone tactile 52x44. */
export function Switch({
  theme, value, onChange, label,
}: { theme: any; value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={{ width: 52, height: 44, justifyContent: 'center' }}
    >
      <View
        style={{
          width: 52,
          height: 32,
          borderRadius: 16,
          backgroundColor: value ? getActionPrimary(theme) : theme.border,
          justifyContent: 'center',
          paddingHorizontal: 3,
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' }} />
      </View>
    </TouchableOpacity>
  );
}

export function Segment({
  theme, options, value, onChange, label,
}: {
  theme: any; options: Array<{ id: string; label: string }>; value: string | null; onChange: (id: string) => void; label: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: 'rgba(28,26,23,0.05)' }}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <TouchableOpacity
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? '#FFFFFF' : 'transparent',
              ...(on ? CARD_SHADOW : {}),
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: on ? theme.text : theme.muted }}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Ligne de case a cocher (>= 56 dp), etat porte par l'icone ET l'accessibilite. */
export function CheckRow({
  theme, label, checked, onChange,
}: { theme: any; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      <View
        style={{
          width: 28, height: 28, borderRadius: 8, borderWidth: 2,
          borderColor: checked ? getActionPrimary(theme) : theme.border,
          backgroundColor: checked ? getActionPrimary(theme) : theme.surface,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {checked ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
      </View>
      <Text style={{ flex: 1, fontSize: 15, color: theme.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Banner({ theme, icon, children, tone = 'info' }: { theme: any; icon: any; children: React.ReactNode; tone?: 'info' | 'error' }) {
  const color = tone === 'error' ? theme.danger : theme.text;
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={{
        flexDirection: 'row',
        gap: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tone === 'error' ? theme.danger : theme.border,
        backgroundColor: tone === 'error' ? theme.danger + '12' : 'rgba(28,26,23,0.04)',
      }}
    >
      <Ionicons name={icon} size={18} color={color} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color }}>{children}</Text>
    </View>
  );
}

export function SourceBadge({ theme, source }: { theme: any; source: 'manual' | 'health' }) {
  const health = source === 'health';
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
        backgroundColor: health ? '#2E9E5B22' : 'rgba(28,26,23,0.07)',
      }}
    >
      {health ? <Ionicons name="checkmark-circle" size={12} color="#1E7A43" /> : null}
      <Text style={{ fontSize: 12, fontWeight: '700', color: health ? '#1E7A43' : theme.muted, letterSpacing: 0.3 }}>
        {health ? 'SANTÉ CONNECTÉE' : 'SAISIE MANUELLE'}
      </Text>
    </View>
  );
}
