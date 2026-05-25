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
} from 'react-native-reanimated';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { showAlert } from '@ziko/plugin-sdk';
import { OBContext } from './_layout';
import { PluginLoader } from '../../../src/lib/PluginLoader';

const LOAD_PHASES = [
  'Analyse de ton profil',
  'Calcul de tes besoins caloriques',
  'Sélection des exercices adaptés',
  'Construction de ton programme',
  'Calibration du coach IA',
];

function goalName(g: string | null): string {
  const map: Record<string, string> = {
    strength: 'force',
    muscle_gain: 'muscle',
    fat_loss: 'sèche',
    endurance: 'cardio',
    health: 'forme',
  };
  return g ? (map[g] ?? 'champion') : 'champion';
}

function goalLabel(g: string | null): string {
  const map: Record<string, string> = {
    strength: 'gagner en force',
    muscle_gain: 'prendre du muscle',
    fat_loss: 'perdre du gras',
    endurance: "l'endurance",
    health: 'la forme générale',
  };
  return g ? (map[g] ?? 'tes objectifs') : 'tes objectifs';
}

// ─── OBReady dark screen ──────────────────────────────────────────────────────

function OBReady() {
  const { obState } = useContext(OBContext);
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [isLoading, setIsLoading] = useState(false);

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        await supabase.from('user_profiles').upsert({
          id: uid,
          goal: obState.goal,
          level: obState.level,
          frequency: obState.frequency,
          equipment: obState.equipment,
          sex: obState.sex,
          age: obState.age,
          height_cm: obState.height,
          weight_kg: obState.weight,
          onboarding_done: true,
        });
      }
      // Trigger mandatory plugin pre-load if available (preloadMandatory is optional static extension)
      await (PluginLoader as any).preloadMandatory?.();
      await refreshProfile();
      router.replace('/(app)');
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
            entering={FadeInUp.springify().damping(12)}
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
          <Text style={{ fontSize: 36, fontWeight: '800', lineHeight: 37, letterSpacing: -0.7, color: '#FFFAF6' }}>
            {'Ton plan\nest prêt'}
            <Text style={{ color: '#FF5C1A' }}>.</Text>
          </Text>

          {/* Sub */}
          <Text style={{
            fontSize: 14.5, color: 'rgba(255,250,246,0.70)', marginTop: 12,
            lineHeight: 21.5, maxWidth: 320,
          }}>
            {`On a calibré tout ça pour ${goalLabel(obState.goal)}, ${obState.frequency}× / semaine. Première séance demain matin.`}
          </Text>

          {/* Program summary card */}
          <View style={{
            marginTop: 28, padding: 16, backgroundColor: 'rgba(255,250,246,0.06)',
            borderWidth: 1, borderColor: 'rgba(255,250,246,0.12)', borderRadius: 16,
          }}>
            <Text style={{
              fontSize: 10, fontWeight: '800', color: '#FF5C1A',
              textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
            }}>
              Ton programme
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFAF6' }}>
              {obState.frequency >= 4 ? 'Push / Pull / Legs' : 'Full Body Progressif'}
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,250,246,0.55)', marginTop: 4 }}>
              {`8 semaines · ${obState.frequency} séances/sem · ~50 min`}
            </Text>
          </View>
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
          <TouchableOpacity
            onPress={handleFinish}
            disabled={isLoading}
            style={{
              paddingVertical: 16, borderRadius: 16, backgroundColor: '#FF5C1A',
              alignItems: 'center', opacity: isLoading ? 0.7 : 1,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
              {isLoading ? 'Chargement…' : "C'est parti, démarrer ma journée →"}
            </Text>
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
  const iconScale = useSharedValue(1);
  useEffect(() => {
    iconScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 800 }),
        withTiming(1.0, { duration: 800 }),
      ),
      -1,
      false,
    );
  }, []);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  // Current step blink animation
  const blinkOpacity = useSharedValue(1);
  useEffect(() => {
    blinkOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0.3, { duration: 500 }),
      ),
      -1,
      false,
    );
  }, []);
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
          {'On prépare ton\nplan, '}
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
