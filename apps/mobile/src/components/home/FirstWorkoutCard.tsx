// v1.21 Phase 2 - carte "Crée ton premier entraînement" (accueil). Contrat : design/02-DESIGN-CONTRACT.md section 2.
// Presentationnelle : la visibilite et les credits viennent de useFirstWorkoutCard (props). Aucun montant en dur.
// Carte standard (rayon 16, bord 1 px, ombre), jamais repoussable, 3 rangees equivalentes (aucun CTA plein).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, AccessibilityInfo } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useCreditStore, useThemeStore } from '@ziko/plugin-sdk';
import {
  FIRST_WORKOUT_COPY as COPY,
  FIRST_WORKOUT_PATHS,
  pathAction,
  pathA11yLabel,
  pathCostView,
  type CardVisibility,
  type CostTone,
  type CreditView,
  type PathDef,
} from '../../lib/firstWorkout';

const DOUBLE_TAP_MS = 600;
const ICON_BG = '#FFF0E8';
const PRESSED_BG = '#F0EFE9';
const COST_COLOR: Record<CostTone, string> = {
  cost: '#B53D05', free: '#17703D', exhausted: '#8A5700', unknown: '#6B6963',
};
const COST_ICON: Record<CostTone, string> = {
  cost: 'flash', free: 'checkmark-circle', exhausted: 'lock-closed', unknown: 'flash-outline',
};

/** Ouvre l'ecran d'epuisement existant (meme appel que l'atelier) ou navigue. Partage avec l'onglet Entrainement. */
export function openPath(path: PathDef, view: CreditView): void {
  const action = pathAction(path, view);
  if (action.type === 'exhausted') {
    useCreditStore.getState().showExhaustionSheet({
      balance: action.balance, required: action.required, earned_today: [], earn_hint: '', reset_timestamp: '',
    });
    return;
  }
  router.push(action.route as any);
}

export function PathRow({
  path, view, onPress, badge, testID, nameOverride, sentenceOverride, deliverableHidden,
}: {
  path: PathDef; view: CreditView; onPress: () => void; badge?: string;
  testID?: string; nameOverride?: string; sentenceOverride?: string; deliverableHidden?: boolean;
}) {
  const cost = pathCostView(path, view);
  const exhaustedAI = path.isAI && view.exhausted;
  const highlightManual = view.exhausted && path.id === 'manual';
  // Garde de double tap : un second appui rapproche n'empile pas un deuxieme ecran (audit phase 2).
  const lastPressRef = useRef(0);
  const guardedPress = () => {
    const now = Date.now();
    if (now - lastPressRef.current < DOUBLE_TAP_MS) return;
    lastPressRef.current = now;
    onPress();
  };
  return (
    <Pressable
      testID={testID}
      onPress={guardedPress}
      accessibilityRole="button"
      accessibilityLabel={pathA11yLabel(path, view, badge)}
      style={({ pressed }: { pressed: boolean }) => ({
        minHeight: 88, paddingVertical: 14, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: pressed ? PRESSED_BG : highlightManual ? ICON_BG : 'transparent',
      })}
    >
      <View style={{
        width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: exhaustedAI ? '#ECEAE4' : highlightManual ? '#FFFFFF' : ICON_BG,
      }}>
        <Ionicons name={path.icon as any} size={22} color={exhaustedAI ? '#6B6963' : '#FF5C1A'} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1C1A17' }}>{nameOverride ?? path.name}</Text>
          {!deliverableHidden && (
            <View style={{ minHeight: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#ECEAE4', justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B6963' }}>{path.deliverable}</Text>
            </View>
          )}
          {badge ? (
            <View style={{ minHeight: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: ICON_BG, justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#B53D05' }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontSize: 14, lineHeight: 20, color: '#6B6963', marginTop: 4 }}>{sentenceOverride ?? path.sentence}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Ionicons name={COST_ICON[cost.tone] as any} size={16} color={COST_COLOR[cost.tone]} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: COST_COLOR[cost.tone], flexShrink: 1 }}>{cost.label}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6B6963" />
    </Pressable>
  );
}

function BalancePill({ view }: { view: CreditView }) {
  const warn = view.exhausted;
  return (
    <View
      accessibilityLabel={view.balanceA11y}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28, paddingHorizontal: 10, borderRadius: 14,
        backgroundColor: warn ? '#FFF4DB' : ICON_BG, borderWidth: 1, borderColor: warn ? '#F0D9A0' : '#FFD7C2',
      }}
    >
      <Ionicons name="flash" size={14} color={warn ? '#8A5700' : '#B53D05'} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: warn ? '#8A5700' : '#B53D05' }}>{view.balanceLabel}</Text>
    </View>
  );
}

/** Squelette H03, affiche seulement si la lecture depasse 400 ms (evite le clignotement pour les comptes existants). */
function CardSkeleton() {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 400);
    return () => clearTimeout(t);
  }, []);
  if (!late) return null;
  return (
    <View
      testID="first-workout-skeleton"
      accessibilityLabel={COPY.loadingLabel}
      accessibilityState={{ busy: true }}
      style={{ borderRadius: 16, borderWidth: 1, borderColor: '#E2E0DA', backgroundColor: '#FFFFFF', padding: 16, gap: 12, marginBottom: 12 }}
    >
      {[0.4, 0.8, 0.6].map((w, i) => (
        <View key={i} style={{ height: i === 1 ? 22 : 14, width: `${w * 100}%`, borderRadius: 6, backgroundColor: '#ECEAE4' }} />
      ))}
      {[0, 1, 2].map((i) => (
        <View key={`r${i}`} style={{ height: 56, borderRadius: 12, backgroundColor: '#F4F3EE' }} />
      ))}
    </View>
  );
}

export interface FirstWorkoutCardProps {
  visibility: CardVisibility;
  credit: CreditView;
}

export default function FirstWorkoutCard({ visibility, credit }: FirstWorkoutCardProps) {
  const theme = useThemeStore((s) => s.theme);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      AccessibilityInfo?.isReduceMotionEnabled?.()?.then((v: boolean) => { if (alive) setReduceMotion(!!v); }).catch(() => {});
    } catch { /* indisponible : mouvement normal */ }
    return () => { alive = false; };
  }, []);

  if (visibility === 'hide') return null;
  if (visibility === 'loading') return <CardSkeleton />;

  return (
    <MotiView
      from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 8 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'timing', duration: reduceMotion ? 100 : 200 }}
      exitTransition={{ type: 'timing', duration: 150 }}
    >
      <View
        testID="first-workout-card"
        accessibilityLabel={COPY.groupLabel}
        style={{
          backgroundColor: theme?.surface ?? '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: theme?.border ?? '#E2E0DA',
          overflow: 'hidden', marginBottom: 12,
          shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
        }}
      >
        <View style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ flexShrink: 1, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#6B6963' }}>
              {COPY.eyebrow}
            </Text>
            <BalancePill view={credit} />
          </View>
          <Text accessibilityRole="header" style={{ fontSize: 22, lineHeight: 26, fontWeight: '700', color: '#1C1A17', marginTop: 8 }}>
            {COPY.title}
          </Text>
          <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 4 }}>{COPY.subtitle}</Text>
          {credit.exhausted && (
            <View style={{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#FCF1DB', flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Ionicons name="alert-circle" size={18} color="#8A5700" />
              <Text style={{ flex: 1, fontSize: 14, color: '#8A5700', fontWeight: '600' }}>{COPY.exhaustedBanner}</Text>
            </View>
          )}
        </View>
        {FIRST_WORKOUT_PATHS.map((p) => (
          <View key={p.id} style={{ borderTopWidth: 1, borderTopColor: '#E2E0DA' }}>
            <PathRow
              testID={`first-workout-${p.id}`}
              path={p}
              view={credit}
              badge={p.id === 'ai-simple' && !credit.exhausted ? COPY.recommended : undefined}
              onPress={() => openPath(p, credit)}
            />
          </View>
        ))}
      </View>
    </MotiView>
  );
}
