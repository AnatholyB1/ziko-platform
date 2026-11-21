import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  FadeInUp,
  useReducedMotion,
} from 'react-native-reanimated';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { showAlert } from '@ziko/plugin-sdk';
import { OBContext } from './_layout';
import { PluginLoader } from '../../../src/lib/PluginLoader';
import {
  ONBOARDING_LOAD_PHASES, ONBOARDING_READY_COPY, goalName, readySubtitle,
} from '../../../src/lib/onboardingEnd';

// CLAR-02 : textes et libelles dans src/lib/onboardingEnd.ts (n'annoncer que ce qui existe).
const LOAD_PHASES = ONBOARDING_LOAD_PHASES;

// ─── OBReady dark screen ──────────────────────────────────────────────────────

function OBReady() {
  const reduceMotion = useReducedMotion();
  const { obState } = useContext(OBContext);
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [isLoading, setIsLoading] = useState(false);

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        // level / frequency / equipment / sex n'ont pas de colonne dediee :
        // stockes dans settings.onboarding (merge pour ne pas ecraser les autres reglages).
        const { data: existing } = await supabase
          .from('ziko_user_profiles')
          .select('settings')
          .eq('id', uid)
          .maybeSingle();
        const prevSettings = (existing?.settings ?? {}) as Record<string, unknown>;
        const { error: upsertError } = await supabase.from('ziko_user_profiles').upsert({
          id: uid,
          goal: obState.goal,
          age: obState.age,
          height_cm: obState.height,
          weight_kg: obState.weight,
          onboarding_done: true,
          settings: {
            ...prevSettings,
            onboarding: {
              level: obState.level,
              frequency: obState.frequency,
              equipment: obState.equipment,
              sex: obState.sex,
            },
          },
        });
        if (upsertError) {
          showAlert('Erreur', `Impossible d'enregistrer ton profil (${upsertError.code ?? 'erreur'}). Réessaie.`);
          return;
        }
      }
      // Trigger mandatory plugin pre-load if available (preloadMandatory is optional static extension)
      await (PluginLoader as any).preloadMandatory?.();
      await refreshProfile();
      // D-01: route to Ziko's mandatory onboarding chat, not straight to /(app) —
      // going straight to /(app) here would strand the athlete with no
      // athlete_state row (that row is only written once Ziko's chat completes).
      router.replace('/(auth)/onboarding/ziko-chat');
    } catch (err: any) {
      showAlert('Erreur', err.message ?? 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1C1A17' }}>
      {/* Radial glow overlay approximation */}
      <View
        style={{
          position: 'absolute', top: -40, left: '50%', marginLeft: -180,
          width: 360, height: 360, borderRadius: 180,
          backgroundColor: 'rgba(255,92,26,0.25)',
        }}
        pointerEvents="none"
      />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 40, justifyContent: 'center' }}>
          {/* Check icon with spring entrance */}
          <Animated.View
            entering={reduceMotion ? undefined : FadeInUp.springify().damping(12)}
            style={{
              width: 76, height: 76, borderRadius: 22,
              backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center',
              shadowColor: 'rgba(255,92,26,0.70)', shadowOffset: { width: 0, height: 12 },
              shadowRadius: 40, shadowOpacity: 1, elevation: 16,
              marginBottom: 24,
            }}
          >
            <Ionicons name="checkmark" size={38} color="#fff" />
          </Animated.View>

          {/* Heading */}
          <Text accessibilityRole="header" style={{ fontSize: 36, fontWeight: '800', lineHeight: 40, letterSpacing: -0.7, color: '#FFFAF6' }}>
            {ONBOARDING_READY_COPY.title}
            <Text style={{ color: '#FF5C1A' }}>.</Text>
          </Text>

          {/* Sub : objectif et rythme reellement saisis, rien de date ni de cree */}
          <Text style={{
            fontSize: 15, color: 'rgba(255,250,246,0.70)', marginTop: 12,
            lineHeight: 22, maxWidth: 320,
          }}>
            {readySubtitle(obState.goal, obState.frequency)}
          </Text>

          {/* La suite : 3 etapes qui menent a la carte "premier entrainement" de l'accueil */}
          <View style={{
            marginTop: 28, backgroundColor: 'rgba(255,250,246,0.06)',
            borderWidth: 1, borderColor: 'rgba(255,250,246,0.12)', borderRadius: 16, overflow: 'hidden',
          }}>
            <Text style={{
              fontSize: 12, fontWeight: '800', color: '#FF8E5A',
              textTransform: 'uppercase', letterSpacing: 1, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 4,
            }}>
              {ONBOARDING_READY_COPY.stepsLabel}
            </Text>
            {ONBOARDING_READY_COPY.steps.map((step, i) => (
              <View
                key={step.title}
                style={{
                  flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 16,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(255,250,246,0.12)',
                }}
              >
                <View style={{
                  width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255,92,26,0.18)',
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFB287' }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFAF6' }}>{step.title}</Text>
                  <Text style={{ fontSize: 14, color: 'rgba(255,250,246,0.65)', marginTop: 2 }}>{step.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
          <TouchableOpacity
            onPress={handleFinish}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={isLoading ? ONBOARDING_READY_COPY.ctaBusy : ONBOARDING_READY_COPY.cta}
            style={{
              minHeight: 52, borderRadius: 16, backgroundColor: '#FF5C1A',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
              {isLoading ? ONBOARDING_READY_COPY.ctaBusy : ONBOARDING_READY_COPY.cta}
            </Text>
            {!isLoading && <Ionicons name="arrow-forward" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── OBPrep loading screen ────────────────────────────────────────────────────

export default function OnboardingStep7() {
  const { obState } = useContext(OBContext);
  const [screenPhase, setScreenPhase] = useState<'loading' | 'ready'>('loading');
  const [loadIdx, setLoadIdx] = useState(0);

  // Advance loading phases
  useEffect(() => {
    if (screenPhase !== 'loading') return;
    if (loadIdx >= LOAD_PHASES.length) {
      const t = setTimeout(() => setScreenPhase('ready'), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLoadIdx((i) => i + 1), 700);
    return () => clearTimeout(t);
  }, [loadIdx, screenPhase]);

  // Icon pulse animation
  const reduceMotion = useReducedMotion();
  const iconScale = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) { iconScale.value = 1; return; }
    iconScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 800 }),
        withTiming(1.0, { duration: 800 }),
      ),
      -1,
      false,
    );
  }, [reduceMotion]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  // Current step blink animation
  const blinkOpacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) { blinkOpacity.value = 1; return; }
    blinkOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0.3, { duration: 500 }),
      ),
      -1,
      false,
    );
  }, [reduceMotion]);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blinkOpacity.value }));

  if (screenPhase === 'ready') {
    return <OBReady />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 40 }}>
        {/* Loading icon with pulse */}
        <Animated.View style={[{
          width: 64, height: 64, borderRadius: 18,
          backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
          shadowColor: 'rgba(255,92,26,0.55)', shadowOffset: { width: 0, height: 8 },
          shadowRadius: 20, shadowOpacity: 1, elevation: 8,
        }, iconStyle]}>
          <Ionicons name="sparkles" size={28} color="#fff" />
        </Animated.View>

        {/* Heading */}
        <Text style={{ fontSize: 26, fontWeight: '800', lineHeight: 30, color: '#1C1A17', marginBottom: 24 }}>
          {'On prépare ton\nprofil, '}
          <Text style={{ color: '#FF5C1A' }}>
            {goalName(obState.goal)}
          </Text>
          {'…'}
        </Text>

        {/* Loading phases list */}
        <View style={{ gap: 10 }}>
          {LOAD_PHASES.map((text, i) => {
            const isDone = i < loadIdx;
            const isCurrent = i === loadIdx;
            return (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                opacity: i > loadIdx ? 0.35 : 1,
              }}>
                {isDone ? (
                  <View style={{
                    width: 22, height: 22, borderRadius: 11, backgroundColor: '#2E9E5B',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="checkmark" size={11} color="#fff" />
                  </View>
                ) : isCurrent ? (
                  <Animated.View style={[{
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: '#FF5C1A', alignItems: 'center', justifyContent: 'center',
                  }, blinkStyle]}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                  </Animated.View>
                ) : (
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: 'rgba(28,26,23,0.08)',
                  }} />
                )}
                <Text style={{
                  fontSize: 13.5, color: '#1C1A17',
                  fontWeight: isCurrent ? '700' : '500',
                }}>{text}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
