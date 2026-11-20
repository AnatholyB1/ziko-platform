import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { progressText, questRatio, type Quest } from '@ziko/plugin-gamification/quests';
import { useAuthStore } from '../../stores/authStore';
import { useHomeQuests } from '../../hooks/useHomeQuests';
import {
  CREATING_RETRY_MS, activeRowLabel, coinsVisible, detectCompletions, doneRowLabel, homeCompletedNote,
  homeQuestsHeaderCount, homeQuestsState, homeToastText, totalCoins, visibleHomeQuests,
  type HomeQuest, type HomeQuestsState,
} from '../../lib/homeQuests';

// Bloc « Quetes du jour » de l'accueil (v1.21 phase 1, QNEW-01..07). Rendu a l'identique de
// .planning/workstreams/activation-inscrit/phases/01-quetes-des-l-inscription/design/01-DESIGN-CONTRACT.md.
// Styles en ligne (pas de StyleSheet.create), icones Ionicons, aucune pastille de pieces sous le niveau 3 (D-05),
// aucun lien « Tout voir » (D-04), aucune quete echouee / expiree (D-08).

const C = {
  surface: '#FFFFFF', border: '#E2E0DA', text: '#1C1A17', muted: '#6B6963', primary: '#FF5C1A',
  tint: '#FFF0E8', tintBorder: '#FFD2BC', orangeText: '#B53D05', track: '#F0EFE9',
  ok: '#17703D', okTint: '#E6F4EC', okBorder: '#BFE1CC',
  coinIcon: '#9A6F00', coinText: '#7A5800', coinTint: '#FBF1D3',
  water: '#1E6FB8', waterTint: '#E3EEF9', err: '#B5301F', errTint: '#FBE9E7', errBorder: '#F0C9C5', skeleton: '#ECEAE4',
};

const cardStyle = {
  backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' as const,
  shadowColor: '#1C1A17', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 3,
};
const surtitre = { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const, color: C.muted };

/** Apparition : fondu + decalage Y (200 ms) ; reduced motion = rendu fixe. */
function FadeIn({ children, delay, reduceMotion }: { children: React.ReactNode; delay: number; reduceMotion: boolean }) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(v, { toValue: 1, duration: 200, delay, useNativeDriver: true }).start();
  }, [reduceMotion]);
  if (reduceMotion) return <>{children}</>;
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

function Skeleton() {
  return (
    <View accessibilityState={{ busy: true }} accessibilityLabel="Chargement des quêtes" style={cardStyle}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ minHeight: 84, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: i === 2 ? 0 : 1, borderBottomColor: C.border }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.skeleton }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ height: 14, width: '60%', borderRadius: 6, backgroundColor: C.skeleton }} />
            <View style={{ height: 12, width: '80%', borderRadius: 6, backgroundColor: C.skeleton }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function StateCard({ icon, tone, title, message, retry, alert }: {
  icon: string; tone: 'info' | 'ok' | 'err'; title: string; message: string; retry?: () => void; alert?: boolean;
}) {
  const palette = tone === 'ok' ? { bg: C.okTint, bd: C.okBorder, fg: C.ok } : tone === 'err' ? { bg: C.errTint, bd: C.errBorder, fg: C.err } : { bg: C.tint, bd: C.tintBorder, fg: C.orangeText };
  return (
    <View style={{ ...cardStyle, backgroundColor: tone === 'ok' ? C.okTint : C.surface, borderColor: tone === 'ok' ? C.okBorder : C.border, padding: 20, alignItems: 'center', gap: 8 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.bd, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as any} size={24} color={palette.fg} />
      </View>
      <Text accessibilityRole={alert ? 'alert' : undefined} style={{ fontSize: 17, fontWeight: '700', fontFamily: 'Manrope_700Bold', color: C.text, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 }}>{message}</Text>
      {retry ? (
        <Pressable
          accessibilityRole="button" accessibilityLabel="Réessayer" onPress={retry}
          style={{ minHeight: 48, alignSelf: 'stretch', marginTop: 8, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
        >
          <Ionicons name="refresh" size={18} color="#FFFFFF" />
          <Text style={{ fontSize: 14, fontWeight: '600', fontFamily: 'Geist_600SemiBold', color: '#FFFFFF' }}>Réessayer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function iconColors(h: HomeQuest) {
  if (h.done) return { fg: C.ok, bg: C.okTint };
  if (h.quest.metric === 'hydration_ml') return { fg: C.water, bg: C.waterTint };
  return { fg: C.primary, bg: C.tint };
}

function QuestRow({ h, last, level, index, reduceMotion, justDone, onOpen }: {
  h: HomeQuest; last: boolean; level: number; index: number; reduceMotion: boolean; justDone: boolean; onOpen: (route: string) => void;
}) {
  const q: Quest = h.quest;
  const { fg, bg } = iconColors(h);
  const showCoins = coinsVisible(level) && q.rewardCoins > 0;
  const counter = progressText(q);
  const rowBase = {
    minHeight: 84, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12,
    borderBottomWidth: last ? 0 : 1, borderBottomColor: C.border,
  };
  const icon = (
    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={(h.done ? 'checkmark-circle' : q.icon) as any} size={22} color={fg} />
    </View>
  );

  if (h.done) {
    return (
      <FadeIn delay={index * 40} reduceMotion={reduceMotion}>
        <View accessible accessibilityLabel={doneRowLabel(h, level)} style={{ ...rowBase, backgroundColor: C.okTint }}>
          {icon}
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'Manrope_700Bold', color: C.text }}>{h.title}</Text>
            <Text style={{ fontSize: 14, color: C.ok }}>{homeCompletedNote(q, level)}</Text>
          </View>
          {justDone && showCoins ? (
            <View style={{ borderRadius: 999, backgroundColor: C.coinTint, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.coinText }}>{`+${q.rewardCoins}`}</Text>
            </View>
          ) : null}
        </View>
      </FadeIn>
    );
  }

  return (
    <FadeIn delay={index * 40} reduceMotion={reduceMotion}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={activeRowLabel(h, counter, level)}
        onPress={() => onOpen(h.action.route)}
        style={rowBase}
      >
        {icon}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '700', fontFamily: 'Manrope_700Bold', color: C.text }}>{h.title}</Text>
          <Text style={{ fontSize: 14, color: C.muted }}>{h.actionText}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(questRatio(q) * 100) }}
              style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: C.track, overflow: 'hidden' }}
            >
              <View style={{ width: `${Math.round(questRatio(q) * 100)}%` as any, height: '100%', backgroundColor: C.primary, borderRadius: 999 }} />
            </View>
            {counter ? <Text style={{ fontSize: 14, color: C.muted }}>{counter}</Text> : null}
            {showCoins ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="disc" size={14} color={C.coinIcon} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.coinText }}>{q.rewardCoins}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: C.tint, borderWidth: 1, borderColor: C.tintBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', fontFamily: 'Geist_600SemiBold', color: C.orangeText }}>{h.action.verb}</Text>
          <Ionicons name="chevron-forward" size={16} color={C.orangeText} />
        </View>
      </Pressable>
    </FadeIn>
  );
}

export interface QuestsBlockViewProps {
  state: HomeQuestsState;
  visible: HomeQuest[];
  level: number;
  reduceMotion: boolean;
  toast: string;
  justDone: ReadonlySet<string>;
  canRetryCreating: boolean;
  onRetry: () => void;
  onOpen: (route: string) => void;
}

/** Rendu pur (sans hook de donnees) : sert aux tests de rendu et a la connexion ci-dessous. */
export function QuestsBlockView(p: QuestsBlockViewProps) {
  let body: React.ReactNode;
  if (p.state === 'loading') body = <Skeleton />;
  else if (p.state === 'error') {
    body = <StateCard tone="err" icon="cloud-offline" alert title="Quêtes indisponibles" message="Impossible de charger tes quêtes. Vérifie ta connexion puis réessaie." retry={p.onRetry} />;
  } else if (p.state === 'creating') {
    body = <StateCard tone="info" icon="sync-outline" title="Tes quêtes se préparent" message="Elles s'affichent ici dans un instant." retry={p.canRetryCreating ? p.onRetry : undefined} />;
  } else if (p.state === 'allDone') {
    const coins = coinsVisible(p.level) ? totalCoins(p.visible) : 0;
    body = <StateCard tone="ok" icon="checkmark-circle" title="Bravo, tout est fait" message={coins > 0 ? `De nouvelles quêtes arrivent bientôt. +${coins} pièces gagnées` : 'De nouvelles quêtes arrivent bientôt.'} />;
  } else {
    body = (
      <View style={cardStyle}>
        {p.visible.map((h, i) => (
          <QuestRow key={h.quest.id} h={h} last={i === p.visible.length - 1} level={p.level} index={i} reduceMotion={p.reduceMotion} justDone={p.justDone.has(h.quest.id)} onOpen={p.onOpen} />
        ))}
      </View>
    );
  }
  const showCount = p.state === 'list' || p.state === 'allDone';
  return (
    <View style={{ marginTop: 8, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text accessibilityRole="header" style={surtitre}>Quêtes du jour</Text>
        {showCount ? <Text style={{ fontSize: 14, color: C.muted }}>{homeQuestsHeaderCount(p.visible)}</Text> : null}
      </View>
      {p.toast ? (
        <View accessibilityLiveRegion="polite" style={{ marginBottom: 8, borderRadius: 12, backgroundColor: C.okTint, borderWidth: 1, borderColor: C.okBorder, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="checkmark-circle" size={18} color={C.ok} />
          <Text style={{ flex: 1, fontSize: 14, color: C.ok }}>{p.toast}</Text>
        </View>
      ) : null}
      {body}
    </View>
  );
}

const TOAST_MS = 3000;

/** Bloc connecte : lecture/synchro, completion sans relance, haptique, annonce d'accessibilite. */
export function QuestsBlock({ creatingRetryMs = CREATING_RETRY_MS }: { creatingRetryMs?: number }) {
  const level = useAuthStore((s) => s.effectiveLevel);
  const { data, isLoading, isError, refetch } = useHomeQuests();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [toast, setToast] = useState('');
  const [justDone, setJustDone] = useState<ReadonlySet<string>>(new Set());
  const [canRetryCreating, setCanRetryCreating] = useState(false);
  const orderRef = useRef<string[]>([]);
  const prevRef = useRef<Quest[] | undefined>(undefined);
  const announcedRef = useRef<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v: boolean) => { if (alive) setReduceMotion(!!v); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // A l'ouverture / au retour sur l'accueil : relecture (la RPC est idempotente).
  useFocusEffect(useCallback(() => { void refetch({ cancelRefetch: false }); }, [refetch]));

  const quests = data?.quests;
  const visible = quests ? visibleHomeQuests(quests, level, orderRef.current) : [];
  useEffect(() => { if (visible.length > 0) orderRef.current = visible.map((v) => v.quest.id); });

  // QNEW-06 : une quete qui passe a « terminee » est annoncee sans relancer l'app.
  useEffect(() => {
    if (!data) return;
    const done = detectCompletions(prevRef.current, data.quests, data.newlyCompleted, announcedRef.current);
    prevRef.current = data.quests;
    if (done.length === 0) return;
    done.forEach((d) => announcedRef.current.add(d.id));
    const text = homeToastText(done, level);
    setToast(text);
    setJustDone((s) => new Set([...s, ...done.map((d) => d.id)]));
    try { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { /* optionnel */ }
    try { AccessibilityInfo.announceForAccessibility?.(text); } catch { /* optionnel */ }
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), TOAST_MS);
  }, [data]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const state = homeQuestsState({ loading: isLoading, error: isError && !data, visible });
  useEffect(() => {
    setCanRetryCreating(false);
    if (state !== 'creating') return;
    const t = setTimeout(() => setCanRetryCreating(true), creatingRetryMs);
    return () => clearTimeout(t);
  }, [state, creatingRetryMs]);

  return (
    <QuestsBlockView
      state={state}
      visible={visible}
      level={level}
      reduceMotion={reduceMotion}
      toast={toast}
      justDone={justDone}
      canRetryCreating={canRetryCreating}
      onRetry={() => { void refetch(); }}
      onOpen={(route) => router.push(route as any)}
    />
  );
}
