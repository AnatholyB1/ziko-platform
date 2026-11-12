import React, { useEffect, useRef, useState } from 'react';
import * as RN from 'react-native';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getActionPrimary, type ThemePalette } from '@ziko/plugin-sdk';
import { SKELETON } from '../../rewards';

// Primitives partagees des onglets Recompenses : styles inline (charte mobile), Ionicons seulement.

const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
} as const;

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <View
      style={[
        { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E0DA', padding: 14 },
        CARD_SHADOW,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Animation desactivee si "reduire les animations" est actif (ou si le module natif est absent). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      (RN as any).AccessibilityInfo?.isReduceMotionEnabled?.()
        ?.then((v: boolean) => alive && setReduced(!!v))
        ?.catch?.(() => {});
    } catch {
      /* ignore */
    }
    return () => {
      alive = false;
    };
  }, []);
  return reduced;
}

/** Fondu d'opacite (150 ms par defaut). Sans Animated (tests) ou reduced-motion : rendu statique. */
export function FadeIn({ trigger, children, duration = 150 }: { trigger: unknown; children: React.ReactNode; duration?: number }) {
  const reduced = useReducedMotion();
  const A = (RN as any).Animated;
  const value = useRef<any>(A ? new A.Value(1) : null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!A || reduced || !value.current) return;
    value.current.setValue(0.2);
    A.timing(value.current, { toValue: 1, duration, useNativeDriver: true }).start();
  }, [trigger]);
  if (!A) return <>{children}</>;
  return <A.View style={{ opacity: value.current }}>{children}</A.View>;
}

export function ProgressBar({ now, max, color, label }: { now: number; max: number; color: string; label: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((now / max) * 100));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ now, min: 0, max }}
      style={{ height: 6, backgroundColor: 'rgba(28,26,23,0.08)', borderRadius: 999, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct}%` as any, height: '100%', backgroundColor: color, borderRadius: 999 }} />
    </View>
  );
}

export function SkeletonRows({ count = 4, height = 64 }: { count?: number; height?: number }) {
  return (
    <View style={{ gap: 8 }} accessibilityLabel="Chargement">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ height, borderRadius: 14, backgroundColor: SKELETON }} />
      ))}
    </View>
  );
}

/** Carte d'erreur unique (B05) : titre, phrase, bouton Reessayer. Jamais de contenu de secours. */
export function ErrorCard({ title, message, onRetry, theme }: { title: string; message: string; onRetry: () => void; theme: ThemePalette }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.danger + '1A', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="cloud-offline" size={22} color={theme.danger} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#1C1A17', marginTop: 12, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: 13, color: '#6B6963', marginTop: 4, textAlign: 'center', lineHeight: 18 }}>{message}</Text>
      <PrimaryButton label="Réessayer" icon="refresh" onPress={onRetry} theme={theme} style={{ marginTop: 16, alignSelf: 'stretch' }} />
    </Card>
  );
}

export function EmptyCard({ icon, title, message, theme }: { icon: string; title: string; message: string; theme: ThemePalette }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as any} size={22} color={theme.primary} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#1C1A17', marginTop: 12, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: 13, color: '#6B6963', marginTop: 4, textAlign: 'center', lineHeight: 18 }}>{message}</Text>
    </Card>
  );
}

/** Bouton plein : fond `getActionPrimary(theme)` (#CF4509), texte blanc 16 gras (Q1 = A). */
export function PrimaryButton({
  label, onPress, theme, icon, disabled, style,
}: { label: string; onPress: () => void; theme: ThemePalette; icon?: string; disabled?: boolean; style?: any }) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        {
          minHeight: 48,
          borderRadius: 14,
          backgroundColor: disabled ? '#D9D6CF' : getActionPrimary(theme),
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 16,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon as any} size={18} color={disabled ? '#6B6963' : '#FFFFFF'} /> : null}
      <Text style={{ fontSize: 16, fontWeight: '800', color: disabled ? '#6B6963' : '#FFFFFF' }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, style }: { label: string; onPress: () => void; style?: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#E2E0DA', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1A17' }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Feuille basse (fiche succes, apercu boutique). */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(28,26,23,0.45)', justifyContent: 'flex-end' }}>
        <TouchableOpacity accessibilityLabel="Fermer" onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: 32,
            gap: 12,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E0DA' }} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function Chip({ label, count, active, onPress, theme }: { label: string; count?: number; active: boolean; onPress: () => void; theme: ThemePalette }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      style={{
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? theme.primary : '#E2E0DA',
        backgroundColor: active ? theme.primaryLight : '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1C1A17' }}>{label}</Text>
      {count !== undefined ? (
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B6963' }}>{count}</Text>
      ) : null}
    </TouchableOpacity>
  );
}
