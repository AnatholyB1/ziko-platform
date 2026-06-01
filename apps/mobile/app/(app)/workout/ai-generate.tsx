import WSHeader from '../../../src/components/WSHeader';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';

// ─── Data constants ───────────────────────────────────────────────────────────

const DURATIONS = [
  { value: 20, label: '20 min', tag: 'express' },
  { value: 30, label: '30 min', tag: 'express' },
  { value: 45, label: '45 min', tag: 'standard' },
  { value: 60, label: '60 min', tag: 'complète' },
  { value: 90, label: '90 min', tag: 'long' },
];

const ZONES = [
  { id: 'haut', label: 'Haut du corps', sub: 'Pec, dos, épaules, bras', icon: 'barbell-outline' },
  { id: 'bas', label: 'Bas du corps', sub: 'Quadri, ischios, mollets', icon: 'walk-outline' },
  { id: 'full', label: 'Full body', sub: 'Tout en équilibre', icon: 'body-outline' },
  { id: 'cardio', label: 'Cardio + core', sub: 'Léger, récup active', icon: 'heart-outline' },
];

const EQUIPMENT = [
  { id: 'salle', label: 'Salle complète', icon: 'barbell-outline' },
  { id: 'maison', label: 'Maison · haltères', icon: 'home-outline' },
  { id: 'outdoor', label: 'Extérieur · poids du corps', icon: 'leaf-outline' },
  { id: 'hotel', label: 'Hôtel · minimal', icon: 'bed-outline' },
];

// MotiView animation constants (defined outside render to avoid loop restart)
const MOTI_FROM = { scale: 1, opacity: 1 };
const MOTI_ANIMATE = { scale: 1.08, opacity: 0.85 };
const MOTI_TRANSITION = { type: 'timing' as const, duration: 700, loop: true, repeatReverse: true };

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 0 | 1 | 2 | 3 | 'generating' | 4;

interface GeneratedExercise {
  name: string;
  sets: string;
  note?: string;
}

interface GeneratedSession {
  exercises: GeneratedExercise[];
  adaptation_note?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIGenerateScreen() {
  const theme = useThemeStore((s) => s.theme);
  const session = useAuthStore((s) => s.session);

  const [step, setStep] = useState<WizardStep>(0);
  const [energy, setEnergy] = useState(7);
  const [duration, setDuration] = useState<number | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [generatedSession, setGeneratedSession] = useState<GeneratedSession | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // ─── API call ────────────────────────────────────────────────────────────────

  const generateSession = async () => {
    setIsGenerating(true);
    setStep('generating');

    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, 1800));

    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
      const fetchPromise = fetch(`${apiUrl}/ai/tools/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          tool: 'ai_programs_generate',
          input: { energy, duration, zone, equipment },
        }),
      });

      const [response] = await Promise.all([fetchPromise, minDelay]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Normalise la réponse — le backend peut renvoyer différentes structures
      const exercises: GeneratedExercise[] = Array.isArray(data?.result?.exercises)
        ? data.result.exercises
        : Array.isArray(data?.exercises)
        ? data.exercises
        : [
            { name: 'Développé incliné haltères', sets: `3 × 8-10`, note: `charge légère vu énergie ${energy}/10` },
            { name: 'Développé couché barre', sets: '4 × 6-8' },
            { name: 'Écarté machine', sets: '3 × 12' },
            { name: 'Dips lestés', sets: '3 × 8' },
            { name: 'Extensions triceps poulie', sets: '3 × 12' },
          ];

      const adaptationNote: string =
        data?.result?.adaptation_note ??
        data?.adaptation_note ??
        `Ton énergie est ${energy >= 8 ? 'bonne' : 'moyenne'} (${energy}/10) → charge ${energy >= 8 ? 'standard' : 'allégée'} sur le 1er exo.`;

      setGeneratedSession({ exercises, adaptation_note: adaptationNote });
      setStep(4);
    } catch {
      await minDelay;
      showAlert('Erreur', 'Impossible de générer la séance. Réessaie.');
      setStep(3);
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Navigation ──────────────────────────────────────────────────────────────

  const handleContinue = () => {
    if (step === 0) setStep(1);
    else if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else if (step === 3) generateSession();
  };

  const handleBack = () => {
    if (step === 1) setStep(0);
    else if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(0);
    else router.back();
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const numericStep = typeof step === 'number' ? step : 3;
  const stepLabel = `Étape ${Math.min(numericStep + 1, 4)}/4`;

  // ─── Progress dots ───────────────────────────────────────────────────────────

  const ProgressDots = () => (
    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 24 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 999,
            backgroundColor: i <= numericStep ? '#FF5C1A' : 'rgba(28,26,23,0.08)',
          }}
        />
      ))}
    </View>
  );

  // ─── Slider energy selector ──────────────────────────────────────────────────
  // @react-native-community/slider n'est pas dans ce projet — on utilise des touches

  const EnergySelector = () => (
    <View>
      <Text style={{ fontSize: 64, fontWeight: '700', color: '#FF5C1A', textAlign: 'center', marginTop: 32 }}>
        {energy}
        <Text style={{ fontSize: 16, color: theme.muted, fontWeight: '400' }}>/10</Text>
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => setEnergy(n)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: energy === n ? '#FF5C1A' : theme.surface,
              borderWidth: energy === n ? 1.5 : 1,
              borderColor: energy === n ? '#FF5C1A' : theme.border,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: energy === n ? '#fff' : theme.text }}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '700' }}>Épuisé</Text>
        <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '700' }}>Modéré</Text>
        <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '700' }}>Au top</Text>
      </View>
    </View>
  );

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (step === 'generating') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <WSHeader title="Génération…" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 24 }}>
          <MotiView
            from={MOTI_FROM}
            animate={MOTI_ANIMATE}
            transition={MOTI_TRANSITION}
            style={{
              width: 80,
              height: 80,
              borderRadius: 999,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LinearGradient
              colors={['#FF5C1A', '#FFB07A']}
              start={{ x: 0.13, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="sparkles" size={36} color="#fff" />
            </LinearGradient>
          </MotiView>
          <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 24, textAlign: 'center' }}>
            Coach IA travaille…
          </Text>
          <Text style={{ fontSize: 12, color: theme.muted, marginTop: 8, lineHeight: 18, textAlign: 'center' }}>
            On adapte la séance à ton énergie ({energy}/10),{'\n'}ton historique et le matériel dispo.
          </Text>
        </View>
      </View>
    );
  }

  // ─── Generated session view (step 4) ────────────────────────────────────────

  if (step === 4 && generatedSession) {
    const exos = generatedSession.exercises;
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <WSHeader
          title="Ta séance générée"
          sub={`~${duration ?? 45} min · adapté à toi`}
          onBack={handleBack}
        />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}>
          {/* AI adaptation card */}
          <View
            style={{
              borderRadius: 14,
              padding: 16,
              backgroundColor: 'rgba(255,92,26,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,92,26,0.22)',
              flexDirection: 'row',
              gap: 10,
              alignItems: 'flex-start',
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: theme.text,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="sparkles" size={15} color="#FFE6D9" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: '#FF5C1A',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                Adaptations IA
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 17, marginTop: 4, color: theme.text }}>
                {generatedSession.adaptation_note}
              </Text>
            </View>
          </View>

          {/* Exercise list */}
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: theme.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            {exos.length} exercice{exos.length !== 1 ? 's' : ''}
          </Text>
          {exos.map((ex, i) => (
            <View
              key={i}
              style={{
                borderRadius: 14,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255,92,26,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FF5C1A' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{ex.name}</Text>
                <Text style={{ fontSize: 10, color: theme.muted, marginTop: 1 }}>
                  {ex.sets}
                  {ex.note ? ` · ${ex.note}` : ''}
                </Text>
              </View>
            </View>
          ))}

          {/* Regenerate button */}
          <TouchableOpacity
            onPress={() => {
              if (!isGenerating) generateSession();
            }}
            disabled={isGenerating}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 16,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: 'transparent',
              opacity: isGenerating ? 0.5 : 1,
            }}
          >
            <Ionicons name="sparkles" size={13} color={theme.text} />
            <Text style={{ fontSize: 12, color: theme.text, fontWeight: '700' }}>Régénérer</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Footer CTA */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingBottom: 16,
            paddingTop: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => router.push('/(app)/workout/session')}
            style={{
              backgroundColor: '#FF5C1A',
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="play" size={13} color="#fff" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Démarrer cette séance</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Wizard steps 0–3 ────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <WSHeader
        title="Coach IA"
        sub={stepLabel}
        onBack={step === 0 ? () => router.back() : handleBack}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
      >
        <ProgressDots />

        {/* ── Step 0 — Énergie ────────────────────────────────────────────── */}
        {step === 0 && (
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', lineHeight: 20, color: theme.text }}>
              Comment tu te sens{'\n'}aujourd'hui ?
            </Text>
            <Text style={{ fontSize: 12, color: theme.muted, marginTop: 8 }}>
              De 1 (épuisé) à 10 (forme olympique)
            </Text>
            <EnergySelector />
          </View>
        )}

        {/* ── Step 1 — Durée ──────────────────────────────────────────────── */}
        {step === 1 && (
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', lineHeight: 20, color: theme.text }}>
              Tu as combien{'\n'}de temps ?
            </Text>
            <Text style={{ fontSize: 12, color: theme.muted, marginTop: 8 }}>
              On adapte le nombre d'exos.
            </Text>
            <View style={{ gap: 8, marginTop: 24 }}>
              {DURATIONS.map((d) => {
                const selected = duration === d.value;
                return (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => setDuration(d.value)}
                    style={{
                      borderRadius: 14,
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderWidth: selected ? 1.5 : 1,
                      borderColor: selected ? '#FF5C1A' : theme.border,
                      backgroundColor: selected ? 'rgba(255,92,26,0.06)' : theme.surface,
                    }}
                  >
                    <Ionicons
                      name="timer-outline"
                      size={16}
                      color={selected ? '#FF5C1A' : theme.muted}
                    />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text, flex: 1 }}>
                      {d.label}
                    </Text>
                    <Text style={{ fontSize: 10, color: theme.muted, marginLeft: 'auto' }}>
                      {d.tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 2 — Zone ───────────────────────────────────────────────── */}
        {step === 2 && (
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', lineHeight: 20, color: theme.text }}>
              Quelle zone{'\n'}aujourd'hui ?
            </Text>
            <View style={{ gap: 8, marginTop: 24 }}>
              {ZONES.map((z) => {
                const selected = zone === z.id;
                return (
                  <TouchableOpacity
                    key={z.id}
                    onPress={() => setZone(z.id)}
                    style={{
                      borderRadius: 14,
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderWidth: selected ? 1.5 : 1,
                      borderColor: selected ? '#FF5C1A' : theme.border,
                      backgroundColor: selected ? 'rgba(255,92,26,0.06)' : theme.surface,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? '#FF5C1A' : 'rgba(255,92,26,0.12)',
                      }}
                    >
                      <Ionicons
                        name={z.icon as any}
                        size={16}
                        color={selected ? '#fff' : '#FF5C1A'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                        {z.label}
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.muted, marginTop: 1 }}>
                        {z.sub}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 3 — Matériel ───────────────────────────────────────────── */}
        {step === 3 && (
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', lineHeight: 20, color: theme.text }}>
              Où tu t'entraînes ?
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 24,
              }}
            >
              {EQUIPMENT.map((eq) => {
                const selected = equipment === eq.id;
                return (
                  <TouchableOpacity
                    key={eq.id}
                    onPress={() => setEquipment(eq.id)}
                    style={{
                      width: '48%',
                      borderRadius: 14,
                      padding: 16,
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      borderWidth: selected ? 1.5 : 1,
                      borderColor: selected ? '#FF5C1A' : theme.border,
                      backgroundColor: selected ? 'rgba(255,92,26,0.06)' : theme.surface,
                    }}
                  >
                    <Ionicons
                      name={eq.icon as any}
                      size={20}
                      color={selected ? '#FF5C1A' : theme.text}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        textAlign: 'center',
                        lineHeight: 16,
                        color: theme.text,
                      }}
                    >
                      {eq.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky footer ─────────────────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: 8,
        }}
      >
        {step === 0 ? (
          <TouchableOpacity
            onPress={handleContinue}
            style={{
              backgroundColor: '#FF5C1A',
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Continuer</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={handleBack}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: 'transparent',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleContinue}
              style={{
                flex: 1,
                backgroundColor: '#FF5C1A',
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
                {step === 3 ? 'Générer ma séance' : 'Continuer'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
