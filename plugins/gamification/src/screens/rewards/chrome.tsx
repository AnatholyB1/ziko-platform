import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemePalette } from '@ziko/plugin-sdk';
import { GOLD, GOLD_BORDER, GOLD_TINT } from '../../rewards';
import { FadeIn } from './ui';

export const TABS = ['Niveau', 'Succès', 'Boutique', 'Quêtes'] as const;
export type RewardsTab = (typeof TABS)[number];

/** En-tete fixe commun aux 4 onglets : retour, titre, puce de solde (or, 44 dp), historique (D-01, R-1). */
export function RewardsHeader({
  title, coins, onBack, onHistory, theme,
}: { title: string; coins: number | null; onBack: () => void; onHistory?: () => void; theme: ThemePalette }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 }}>
      <TouchableOpacity
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Retour"
        style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: theme.text + '10', alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="chevron-back" size={18} color={theme.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.4, flex: 1, color: theme.text }}>{title}</Text>
      <View
        accessible
        accessibilityLabel={coins === null ? 'Solde indisponible' : `Solde : ${coins} pièces`}
        accessibilityLiveRegion="polite"
        style={{
          minHeight: 44,
          paddingHorizontal: 14,
          borderRadius: 22,
          backgroundColor: GOLD_TINT,
          borderWidth: 1,
          borderColor: GOLD_BORDER,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Ionicons name="cash" size={16} color={GOLD} />
        <FadeIn trigger={coins}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: GOLD }}>{coins === null ? '—' : coins}</Text>
        </FadeIn>
      </View>
      {onHistory ? (
        <TouchableOpacity
          onPress={onHistory}
          accessibilityRole="button"
          accessibilityLabel="Historique des gains"
          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: theme.text + '10', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="time-outline" size={20} color={theme.text} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Onglets soulignes primaire : Niveau, Succes, Boutique, Quetes, dans cet ordre (R-1). */
export function RewardsTabs({ active, onChange, theme }: { active: RewardsTab; onChange: (t: RewardsTab) => void; theme: ThemePalette }) {
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E0DA', marginHorizontal: 18 }} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const isActive = tab === active;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => onChange(tab)}
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityState={{ selected: isActive }}
            style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: isActive ? theme.primary : 'transparent', marginBottom: -1 }}
          >
            <Text style={{ fontSize: 14, fontWeight: isActive ? '800' : '600', color: isActive ? theme.text : theme.muted }}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Toast (pas de modale de confirmation) : disparait seul, annonce a VoiceOver / TalkBack. */
export function Toast({ message, onHide, theme }: { message: string | null; onHide: () => void; theme: ThemePalette }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onHide, 3200);
    return () => clearTimeout(t);
  }, [message]);
  if (!message) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 18, right: 18, bottom: 108, alignItems: 'center' }}>
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={{ backgroundColor: theme.text, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF', flexShrink: 1 }}>{message}</Text>
      </View>
    </View>
  );
}
