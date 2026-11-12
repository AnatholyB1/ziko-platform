import React, { useEffect, useRef, useState } from 'react';
import * as RN from 'react-native';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemePalette } from '@ziko/plugin-sdk';
import {
  GOLD, GOLD_TINT, remainingHint, unlockedShort, unlockedLong,
  type AchievementView,
} from '../../rewards';
import { Card, ErrorCard, ProgressBar, SkeletonRows, Sheet, SecondaryButton, useReducedMotion } from './ui';

export interface AchievementsData {
  locked: AchievementView[];
  unlocked: AchievementView[];
  total: number;
  unlockedCount: number;
  pct: number;
}

/** Icone ronde : gris -> or en 250 ms au deblocage (instantane si reduced-motion). */
function AchievementIcon({ a, size = 44 }: { a: AchievementView; size?: number }) {
  const reduced = useReducedMotion();
  const A = (RN as any).Animated;
  const prev = useRef(a.unlocked);
  const value = useRef<any>(A ? new A.Value(a.unlocked ? 1 : 0) : null);
  useEffect(() => {
    if (!A || !value.current) return;
    if (!prev.current && a.unlocked) {
      if (reduced) value.current.setValue(1);
      else A.timing(value.current, { toValue: 1, duration: 250, useNativeDriver: false }).start();
    } else {
      value.current.setValue(a.unlocked ? 1 : 0);
    }
    prev.current = a.unlocked;
  }, [a.unlocked]);

  const iconColor = a.unlocked ? GOLD : '#6B6963';
  const bg = A && value.current
    ? value.current.interpolate({ inputRange: [0, 1], outputRange: ['#ECEAE4', GOLD_TINT] })
    : a.unlocked ? GOLD_TINT : '#ECEAE4';
  const Wrapper: any = A ? A.View : View;
  return (
    <Wrapper style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={a.iconName as any} size={Math.round(size * 0.5)} color={iconColor} />
    </Wrapper>
  );
}

function AchievementRow({ a, onPress, theme }: { a: AchievementView; onPress: () => void; theme: ThemePalette }) {
  const label = a.unlocked
    ? `${a.name}. ${a.description} ${unlockedShort(a.earnedAt)}`
    : `${a.name}. ${a.description} Progression ${a.current} sur ${a.target}`;
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={label} activeOpacity={0.8}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
        <AchievementIcon a={a} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>{a.name}</Text>
          <Text style={{ fontSize: 12.5, color: theme.muted }}>{a.description}</Text>
          {a.unlocked ? (
            <Text style={{ fontSize: 12, fontWeight: '700', color: GOLD }}>{unlockedShort(a.earnedAt)}</Text>
          ) : (
            <View style={{ marginTop: 3 }}>
              <ProgressBar now={a.current} max={a.target} color={theme.primary} label={`${a.name} : ${a.current} sur ${a.target}`} />
            </View>
          )}
        </View>
        {!a.unlocked ? (
          <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>{a.current} / {a.target}</Text>
        ) : (
          <Ionicons name="checkmark-circle" size={20} color={GOLD} />
        )}
      </Card>
    </TouchableOpacity>
  );
}

function AchievementSheet({ a, onClose, theme }: { a: AchievementView | null; onClose: () => void; theme: ThemePalette }) {
  return (
    <Sheet visible={!!a} onClose={onClose}>
      {a ? (
        <>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <AchievementIcon a={a} size={64} />
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: a.unlocked ? GOLD : theme.muted }}>
              {a.unlocked ? 'DÉBLOQUÉ' : 'VERROUILLÉ'}
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center' }}>{a.name}</Text>
            <Text style={{ fontSize: 14, color: theme.muted, textAlign: 'center' }}>{a.description}</Text>
          </View>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Progression</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>{a.current} / {a.target}</Text>
            </View>
            <ProgressBar now={a.current} max={a.target} color={a.unlocked ? GOLD : theme.primary} label={`Progression : ${a.current} sur ${a.target}`} />
            {/* La date n'apparait que si le succes est debloque : jamais de date inventee (R-4). */}
            {a.unlocked && a.earnedAt ? (
              <Text style={{ fontSize: 13, color: theme.muted }}>{unlockedLong(a.earnedAt)}</Text>
            ) : null}
            {!a.unlocked && remainingHint(a) ? (
              <Text style={{ fontSize: 13, color: theme.muted }}>{remainingHint(a)}</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Récompense</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: GOLD }}>+{a.rewardCoins} pièces</Text>
          </View>
          <SecondaryButton label="Fermer" onPress={onClose} />
        </>
      ) : null}
    </Sheet>
  );
}

export function AchievementsTab({
  data, loading, error, onRetry, theme,
}: { data: AchievementsData | undefined; loading: boolean; error: boolean; onRetry: () => void; theme: ThemePalette }) {
  const [selected, setSelected] = useState<AchievementView | null>(null);

  // Pas de liste de secours : erreur = carte B05 seulement (REWD-10, R-10).
  if (error && !data) {
    return (
      <ErrorCard
        theme={theme}
        title="Succès indisponibles"
        message="Impossible de charger tes succès. Rien n'est perdu : réessaie dans un instant."
        onRetry={onRetry}
      />
    );
  }
  if (loading && !data) return <SkeletonRows count={5} />;
  if (!data) return null;

  // La feuille ouverte suit la donnee fraiche (ex. deblocage pendant l'affichage).
  const current = selected
    ? data.locked.concat(data.unlocked).find((x) => x.slug === selected.slug) ?? selected
    : null;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{data.unlockedCount} sur {data.total} débloqués</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.muted }}>{data.pct} %</Text>
      </View>

      {data.locked.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ fontSize: 12, fontWeight: '800', color: theme.muted }}>À débloquer</Text>
          {data.locked.map((a) => (
            <AchievementRow key={a.slug} a={a} onPress={() => setSelected(a)} theme={theme} />
          ))}
        </View>
      ) : null}

      {data.unlocked.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ fontSize: 12, fontWeight: '800', color: theme.muted }}>Débloqués</Text>
          {data.unlocked.map((a) => (
            <AchievementRow key={a.slug} a={a} onPress={() => setSelected(a)} theme={theme} />
          ))}
        </View>
      ) : null}

      <AchievementSheet a={current} onClose={() => setSelected(null)} theme={theme} />
    </View>
  );
}
