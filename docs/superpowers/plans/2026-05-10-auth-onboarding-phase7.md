# Auth & Onboarding Phase 7 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign auth screens (Welcome, Sign In, Sign Up, Forgot) and rebuild onboarding from 5 old steps to 8 new steps following the v2 design spec. The new flow: dark hero Welcome → Objectif → Niveau → Fréquence → Équipement → Bio → Préparation → Prêt.

**Architecture:**
- Auth: `apps/mobile/app/(auth)/` — add `welcome.tsx`, `forgot.tsx`, redesign `login.tsx` and `register.tsx`, update `_layout.tsx`
- Onboarding: `apps/mobile/app/(auth)/onboarding/` — replace 5 steps with 8 new steps (step-1 through step-8), no shared layout file needed
- DB: Supabase migration 022 — add `fitness_level`, `workout_frequency`, `equipment` to `user_profiles`; update goal CHECK to include `strength` and `health`

**Design source:** `index.html` at project root — auth components at line 6415 (`AuthFlow`, `AuthWelcome`, `AuthSignin`, `AuthSignup`, `AuthForgot`), onboarding at line 5354 (`OB_STEPS`, `OnboardingShell`, `OBGoal`, etc.)

**Tech Stack:** React Native, Expo Router, Ionicons, Supabase, `useThemeStore`, `useAuthStore`, `showAlert` from `@ziko/plugin-sdk`, MotiView from `moti`

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/022_onboarding_profile_fields.sql` | Create |
| `apps/mobile/app/(auth)/_layout.tsx` | Modify — add welcome + forgot screens |
| `apps/mobile/app/(auth)/welcome.tsx` | Create — dark hero |
| `apps/mobile/app/(auth)/login.tsx` | Rewrite |
| `apps/mobile/app/(auth)/register.tsx` | Rewrite |
| `apps/mobile/app/(auth)/forgot.tsx` | Create |
| `apps/mobile/app/(auth)/onboarding/step-1.tsx` | Rewrite — OB Welcome hero |
| `apps/mobile/app/(auth)/onboarding/step-2.tsx` | Rewrite — Goal selection |
| `apps/mobile/app/(auth)/onboarding/step-3.tsx` | Rewrite — Level selection |
| `apps/mobile/app/(auth)/onboarding/step-4.tsx` | Rewrite — Frequency selection |
| `apps/mobile/app/(auth)/onboarding/step-5.tsx` | Rewrite — Equipment selection |
| `apps/mobile/app/(auth)/onboarding/step-6.tsx` | Create — Bio (age, weight, height) |
| `apps/mobile/app/(auth)/onboarding/step-7.tsx` | Create — Prep summary |
| `apps/mobile/app/(auth)/onboarding/step-8.tsx` | Create — Ready / Done |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/022_onboarding_profile_fields.sql`

Add three new columns to `user_profiles` for the new onboarding fields, and update the goal CHECK to include `strength` and `health`.

- [ ] **Step 1: Create migration file**

```sql
-- Migration 022: Add onboarding profile fields
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS workout_frequency TEXT CHECK (workout_frequency IN ('2', '3', '4', '5+')),
  ADD COLUMN IF NOT EXISTS equipment TEXT CHECK (equipment IN ('gym', 'home', 'bodyweight', 'outdoor'));

-- Extend goal CHECK to include new design values
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_goal_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_goal_check
    CHECK (goal IN ('muscle_gain', 'fat_loss', 'maintenance', 'endurance', 'strength', 'health'));
```

- [ ] **Step 2: Apply migration**

```bash
cd /c/ziko-platform && supabase db push 2>&1 | tail -10
```

If local Supabase isn't running, skip this step — migration will be applied on next `supabase db push`.

- [ ] **Step 3: Commit**

```bash
cd /c/ziko-platform && rtk git add supabase/migrations/022_onboarding_profile_fields.sql && rtk git commit -m "feat(db): migration 022 — add fitness_level, workout_frequency, equipment to user_profiles"
```

---

## Task 2: Auth Layout + New Screens (welcome, forgot)

**Files:**
- Modify: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(auth)/welcome.tsx`
- Create: `apps/mobile/app/(auth)/forgot.tsx`

### Step 1: Update `_layout.tsx` to register `welcome` and `forgot`

Replace the entire file:

```tsx
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  if (session && profile?.onboarding_done) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
```

- [ ] **Step 2: Create `welcome.tsx`** — dark hero screen with social proof

```tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../src/lib/supabase';

const AVATAR_COLORS = ['#FF5C1A', '#7B5BD0', '#2E9E5B', '#E8A33A'];

export default function WelcomeScreen() {
  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) showAlert('Erreur', error.message);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1C1A17' }}>
      {/* Orange glow top-right */}
      <View style={{
        position: 'absolute', top: -120, right: -80, width: 320, height: 320,
        borderRadius: 160, backgroundColor: 'rgba(255,92,26,0.35)',
        // No blur in RN — approximated with large radius
      }} pointerEvents="none" />
      {/* Violet glow bottom-left */}
      <View style={{
        position: 'absolute', bottom: -100, left: -60, width: 260, height: 260,
        borderRadius: 130, backgroundColor: 'rgba(123,91,208,0.25)',
      }} pointerEvents="none" />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 18 }}>

          {/* Logo */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 36 }}>
            <View style={{
              width: 30, height: 30, borderRadius: 9, backgroundColor: '#FF5C1A',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontWeight: '800', fontSize: 16, color: '#fff' }}>Z</Text>
            </View>
            <Text style={{ fontWeight: '800', fontSize: 16, color: '#FFFAF6', letterSpacing: 1 }}>ZIKO</Text>
          </View>

          {/* Hero copy */}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{
              fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase',
              color: '#FF5C1A', marginBottom: 14,
            }}>Coach IA · 18 modules</Text>

            <Text style={{
              fontSize: 42, fontWeight: '800', color: '#FFFAF6', lineHeight: 44,
              letterSpacing: -0.8, marginBottom: 16,
            }}>
              {'Ton corps,\n'}
              <Text style={{ color: '#FF5C1A' }}>ton plan</Text>
              {',\nton coach.'}
            </Text>

            <Text style={{
              fontSize: 14, color: 'rgba(255,250,246,0.72)', lineHeight: 21, marginBottom: 28,
            }}>
              Programmes adaptatifs, suivi nutritionnel, communauté qui pousse.
              Construit pour ceux qui ne lâchent rien.
            </Text>

            {/* Social proof */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row' }}>
                {AVATAR_COLORS.map((c, i) => (
                  <View key={i} style={{
                    width: 24, height: 24, borderRadius: 12, backgroundColor: c,
                    borderWidth: 2, borderColor: '#1C1A17',
                    marginLeft: i ? -7 : 0,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 8, fontWeight: '800', color: '#fff' }}>
                      {['MA', 'TK', 'JP', 'SR'][i]}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11.5, color: 'rgba(255,250,246,0.65)', lineHeight: 16 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>240k+ </Text>
                athlètes —{' '}
                <Text style={{ color: '#fff', fontWeight: '700' }}>4.8★</Text>
                {' · 18k avis'}
              </Text>
            </View>
          </View>

          {/* CTAs */}
          <View style={{ gap: 10 }}>
            {/* Google */}
            <TouchableOpacity
              onPress={handleGoogle}
              style={{
                paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
                backgroundColor: '#fff',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <Ionicons name="logo-google" size={16} color="#1C1A17" />
              <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#1C1A17' }}>Continuer avec Google</Text>
            </TouchableOpacity>

            {/* Email → Sign up */}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
              style={{
                paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
                borderWidth: 1, borderColor: 'rgba(255,250,246,0.16)',
                backgroundColor: 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#FFFAF6' }}>Continuer avec un email</Text>
            </TouchableOpacity>

            {/* Sign in link */}
            <Text style={{ textAlign: 'center', fontSize: 12.5, color: 'rgba(255,250,246,0.6)', marginTop: 4 }}>
              Déjà un compte ?{' '}
              <Text
                onPress={() => router.push('/(auth)/login')}
                style={{ color: '#FF5C1A', fontWeight: '700' }}
              >
                Connecte-toi
              </Text>
            </Text>

            <Text style={{
              textAlign: 'center', fontSize: 10.5, color: 'rgba(255,250,246,0.4)',
              lineHeight: 15, paddingHorizontal: 12, marginTop: 4,
            }}>
              En continuant tu acceptes nos CGU et notre politique de confidentialité.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
```

- [ ] **Step 3: Create `forgot.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../src/lib/supabase';

export default function ForgotScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (email.length < 4) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      showAlert('Erreur', err.message ?? 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldStyle = {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.text,
    fontSize: 14,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* Back button */}
          <View style={{ padding: '8px 16px 0' as any, paddingTop: 8, paddingHorizontal: 16 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 36, height: 36, borderRadius: 12,
                backgroundColor: theme.text + '10',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 18 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 12 }}>
              Pas de panique
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: theme.text, lineHeight: 34, letterSpacing: -0.5 }}>
              {sent ? 'Vérifie ta boîte' : 'Mot de passe oublié ?'}
            </Text>
            <Text style={{ fontSize: 13.5, color: theme.muted, marginTop: 8, lineHeight: 19 }}>
              {sent
                ? "On t'a envoyé un lien de réinitialisation. Vérifie aussi ton dossier spam."
                : "Entre ton email, on t'envoie un lien pour le réinitialiser."}
            </Text>
          </View>

          {!sent ? (
            <>
              <View style={{ paddingHorizontal: 24 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="toi@email.com"
                  placeholderTextColor={theme.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                  style={fieldStyle}
                />
              </View>
              <View style={{ flex: 1 }} />
              <View style={{ padding: 24, paddingTop: 16 }}>
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={email.length < 4 || isLoading}
                  style={{
                    paddingVertical: 14, borderRadius: 14,
                    backgroundColor: email.length >= 4 ? theme.text : theme.text + '30',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#fff' }}>
                    {isLoading ? 'Envoi…' : 'Envoyer le lien'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={{ paddingHorizontal: 24 }}>
                <View style={{
                  padding: 16, borderRadius: 16,
                  backgroundColor: '#2E9E5B' + '14',
                  borderWidth: 1, borderColor: '#2E9E5B' + '40',
                  flexDirection: 'row', gap: 12, alignItems: 'flex-start',
                }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 11, backgroundColor: '#2E9E5B',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>
                      Email envoyé à {email}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4, lineHeight: 17 }}>
                      Le lien expire dans 30 minutes.{' '}
                      <Text onPress={() => setSent(false)} style={{ color: '#FF5C1A', fontWeight: '700' }}>
                        Renvoyer
                      </Text>
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ flex: 1 }} />
              <View style={{ padding: 24, paddingTop: 16 }}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{ paddingVertical: 14, borderRadius: 14, backgroundColor: theme.text, alignItems: 'center' }}
                >
                  <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#fff' }}>Retour à la connexion</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 5: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(auth)'/_layout.tsx apps/mobile/app/'(auth)'/welcome.tsx apps/mobile/app/'(auth)'/forgot.tsx && rtk git commit -m "feat(auth): add welcome dark hero + forgot password screen, update layout routing"
```

---

## Task 3: Redesign login.tsx and register.tsx

**Files:**
- Rewrite: `apps/mobile/app/(auth)/login.tsx`
- Rewrite: `apps/mobile/app/(auth)/register.tsx`

### login.tsx — v2 design

- [ ] **Step 1: Rewrite `login.tsx`**

Remove the current logo/image header. Use the new auth header pattern (back chevron, eyebrow "Bon retour", title "Connecte-toi", sub). Password show/hide toggle. Forgot link. Sticky CTA at bottom.

```tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../src/lib/supabase';

export default function LoginScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const valid = email.length > 3 && password.length >= 4;

  const handleLogin = async () => {
    if (!valid) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/(app)');
    } catch (err: any) {
      showAlert('Connexion impossible', err.message ?? 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldStyle = {
    backgroundColor: theme.surface,
    borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    paddingHorizontal: 14, paddingVertical: 14,
    color: theme.text, fontSize: 14, flex: 1,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          {/* Back */}
          <View style={{ paddingTop: 8, paddingHorizontal: 16 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 36, height: 36, borderRadius: 12,
                backgroundColor: theme.text + '10',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 18 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 12 }}>
              Bon retour
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: theme.text, lineHeight: 34, letterSpacing: -0.5 }}>
              Connecte-toi
            </Text>
            <Text style={{ fontSize: 13.5, color: theme.muted, marginTop: 8, lineHeight: 19 }}>
              Reprends là où tu t'es arrêté.
            </Text>
          </View>

          {/* Fields */}
          <View style={{ paddingHorizontal: 24, gap: 14 }}>
            {/* Email */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Email</Text>
              <TextInput
                value={email} onChangeText={setEmail}
                placeholder="toi@email.com" placeholderTextColor={theme.muted}
                keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                style={fieldStyle}
              />
            </View>

            {/* Password + show/hide */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Mot de passe</Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
              }}>
                <TextInput
                  value={password} onChangeText={setPassword}
                  placeholder="••••••••" placeholderTextColor={theme.muted}
                  secureTextEntry={!showPw} autoComplete="password"
                  style={{ ...fieldStyle, borderWidth: 0 }}
                />
                <TouchableOpacity onPress={() => setShowPw((s) => !s)} style={{ paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>{showPw ? 'Cacher' : 'Voir'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot link */}
            <View style={{ alignItems: 'flex-end' }}>
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot')}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FF5C1A' }}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          {/* CTA */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16, gap: 10 }}>
            <TouchableOpacity
              onPress={handleLogin}
              disabled={!valid || isLoading}
              style={{
                paddingVertical: 14, borderRadius: 14,
                backgroundColor: valid ? theme.text : theme.text + '30',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#fff' }}>
                {isLoading ? 'Connexion…' : 'Se connecter'}
              </Text>
            </TouchableOpacity>

            <Text style={{ textAlign: 'center', fontSize: 12.5, color: theme.muted }}>
              Pas encore de compte ?{' '}
              <Text onPress={() => router.push('/(auth)/register')} style={{ color: '#FF5C1A', fontWeight: '700' }}>
                Créer
              </Text>
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

### register.tsx — v2 design with password strength

- [ ] **Step 2: Rewrite `register.tsx`**

Use the same auth pattern. Add password strength bar. After signup, route to `/(auth)/onboarding/step-1`.

```tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../src/lib/supabase';

function getStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0–4
}

const STRENGTH_LABELS = ['', 'Faible', 'Correct', 'Fort', 'Excellent'];
const STRENGTH_COLORS = ['transparent', '#E94B3C', '#E8A33A', '#2E9E5B', '#2E9E5B'];

export default function RegisterScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const strength = getStrength(password);
  const valid = name.length > 1 && email.length > 3 && password.length >= 6;

  const handleRegister = async () => {
    if (!valid) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;
      router.replace('/(auth)/onboarding/step-1');
    } catch (err: any) {
      showAlert('Inscription impossible', err.message ?? 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldStyle = {
    backgroundColor: theme.surface,
    borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    paddingHorizontal: 14, paddingVertical: 14,
    color: theme.text, fontSize: 14,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          {/* Back */}
          <View style={{ paddingTop: 8, paddingHorizontal: 16 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 36, height: 36, borderRadius: 12,
                backgroundColor: theme.text + '10',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 18 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 12 }}>
              Bienvenue
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: theme.text, lineHeight: 34, letterSpacing: -0.5 }}>
              Crée ton compte
            </Text>
            <Text style={{ fontSize: 13.5, color: theme.muted, marginTop: 8, lineHeight: 19 }}>
              2 minutes pour démarrer. Tu pourras compléter ton profil ensuite.
            </Text>
          </View>

          {/* Fields */}
          <View style={{ paddingHorizontal: 24, gap: 14 }}>
            {/* Name */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Prénom</Text>
              <TextInput
                value={name} onChangeText={setName}
                placeholder="Comment on t'appelle ?" placeholderTextColor={theme.muted}
                autoComplete="name"
                style={fieldStyle}
              />
            </View>

            {/* Email */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Email</Text>
              <TextInput
                value={email} onChangeText={setEmail}
                placeholder="toi@email.com" placeholderTextColor={theme.muted}
                keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                style={fieldStyle}
              />
            </View>

            {/* Password + strength */}
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Mot de passe</Text>
              <TextInput
                value={password} onChangeText={setPassword}
                placeholder="6 caractères minimum" placeholderTextColor={theme.muted}
                secureTextEntry
                style={fieldStyle}
              />
              {password.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        backgroundColor: i < strength ? STRENGTH_COLORS[strength] : theme.border,
                      }} />
                    ))}
                  </View>
                  <Text style={{
                    fontSize: 10.5, fontWeight: '700',
                    color: STRENGTH_COLORS[strength], minWidth: 60, textAlign: 'right',
                  }}>
                    {STRENGTH_LABELS[strength]}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 16 }} />

          {/* CTA */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16, gap: 10 }}>
            <TouchableOpacity
              onPress={handleRegister}
              disabled={!valid || isLoading}
              style={{
                paddingVertical: 14, borderRadius: 14,
                backgroundColor: valid ? '#FF5C1A' : '#FF5C1A' + '40',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#fff' }}>
                {isLoading ? 'Création…' : 'Continuer'}
              </Text>
            </TouchableOpacity>

            <Text style={{ textAlign: 'center', fontSize: 12.5, color: theme.muted }}>
              Déjà un compte ?{' '}
              <Text onPress={() => router.push('/(auth)/login')} style={{ color: '#FF5C1A', fontWeight: '700' }}>
                Se connecter
              </Text>
            </Text>

            <Text style={{
              textAlign: 'center', fontSize: 10.5, color: theme.muted,
              lineHeight: 15, paddingHorizontal: 12,
            }}>
              En créant ton compte tu acceptes nos CGU et notre politique de confidentialité.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(auth)'/login.tsx apps/mobile/app/'(auth)'/register.tsx && rtk git commit -m "feat(auth): redesign login + register screens to v2 style with password strength"
```

---

## Task 4: Onboarding Steps 1–4 (Welcome, Goal, Level, Frequency)

All steps share the same `OBShell` inline component pattern:
- Progress bar (animated, step/total)
- Back button (disabled on step 1)
- Content area
- Sticky CTA button

**Shared OBShell pattern** (inline in each step — no shared file needed):

```tsx
function OBShell({
  step, total, onBack, onNext, canNext, ctaLabel, children,
}: {
  step: number; total: number;
  onBack: () => void; onNext: () => void;
  canNext: boolean; ctaLabel?: string; children: React.ReactNode;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Progress row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingTop: 14 }}>
        <TouchableOpacity
          onPress={onBack}
          disabled={step === 0}
          style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: step === 0 ? 'transparent' : theme.text + '10',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {step > 0 && <Ionicons name="chevron-back" size={16} color={theme.text} />}
        </TouchableOpacity>
        <View style={{ flex: 1, height: 4, backgroundColor: theme.text + '14', borderRadius: 999, overflow: 'hidden' }}>
          <View style={{
            width: `${((step + 1) / total) * 100}%` as any,
            height: '100%', backgroundColor: '#FF5C1A', borderRadius: 999,
          }} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, minWidth: 28, textAlign: 'right' }}>
          {step + 1}/{total}
        </Text>
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingHorizontal: 22 }}>{children}</View>

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
        <TouchableOpacity
          onPress={canNext ? onNext : undefined}
          style={{
            paddingVertical: 15, borderRadius: 16, alignItems: 'center',
            backgroundColor: '#FF5C1A',
            opacity: canNext ? 1 : 0.35,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
            {ctaLabel ?? 'Continuer'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

### step-1.tsx — OB Welcome hero (no data, no save)

- [ ] **Step 1: Rewrite `step-1.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';

const TOTAL = 8;

export default function OnboardingStep1() {
  const theme = useThemeStore((s) => s.theme);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1 }}>
        {/* No progress on welcome — fullscreen */}
        <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: 'center' }}>
          {/* Icon */}
          <View style={{
            width: 76, height: 76, borderRadius: 22,
            backgroundColor: '#FF5C1A',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 28,
          }}>
            <Ionicons name="flash" size={36} color="#fff" />
          </View>

          <Text style={{
            fontSize: 40, fontWeight: '800', color: theme.text,
            lineHeight: 42, letterSpacing: -1, marginBottom: 14,
          }}>
            {'Bienvenue\nsur Ziko.'}
          </Text>
          <Text style={{ fontSize: 15, color: theme.muted, lineHeight: 22, maxWidth: 320, marginBottom: 28 }}>
            Ton coach perso, tes séances, ta nutrition, tes records — tout au même endroit.
          </Text>

          {/* Benefit bullets */}
          <View style={{ gap: 10 }}>
            {[
              { icon: 'sparkles-outline' as const, text: 'Programmes générés par IA selon ta forme du jour' },
              { icon: 'barbell-outline' as const, text: 'Suivi précis : volume, RPE, PR, progression' },
              { icon: 'trophy-outline' as const, text: 'Objectifs concrets, streak motivante' },
            ].map((b) => (
              <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 30, height: 30, borderRadius: 9,
                  backgroundColor: '#FF5C1A' + '20', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={b.icon} size={15} color="#FF5C1A" />
                </View>
                <Text style={{ fontSize: 13.5, color: theme.text, flex: 1 }}>{b.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/onboarding/step-2')}
            style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A' }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Allez, on y va</Text>
          </TouchableOpacity>
          <Text style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: theme.muted }}>
            Déjà un compte ?{' '}
            <Text onPress={() => router.replace('/(auth)/login')} style={{ color: '#FF5C1A', fontWeight: '700' }}>
              Se connecter
            </Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

### step-2.tsx — Objectif (goal selection)

- [ ] **Step 2: Rewrite `step-2.tsx`**

Goal options: strength, muscle, fat, endurance, health. Save to `user_profiles.goal`.

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

const TOTAL = 8;
const STEP = 1; // 0-indexed

const OB_GOALS = [
  { id: 'strength',   label: 'Gagner en force',   sub: 'Plus lourd, plus fort',     icon: 'barbell-outline' as const, tint: '#FF5C1A' },
  { id: 'muscle_gain',label: 'Prendre du muscle',  sub: 'Hypertrophie, volume',      icon: 'flash-outline' as const,   tint: '#7B5BD0' },
  { id: 'fat_loss',   label: 'Perdre du gras',     sub: 'Sécher, recomposition',     icon: 'flame-outline' as const,   tint: '#E94B3C' },
  { id: 'endurance',  label: 'Endurance',          sub: 'Cardio, souffle, course',   icon: 'walk-outline' as const,    tint: '#2E7BF6' },
  { id: 'health',     label: 'Forme générale',     sub: 'Bouger plus, vivre mieux',  icon: 'heart-outline' as const,   tint: '#2E9E5B' },
];

function OBShell({ step, total, onBack, onNext, canNext, ctaLabel, children }: any) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <TouchableOpacity onPress={onBack} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.text + '10', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, height: 4, backgroundColor: theme.text + '14', borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ width: `${((step + 1) / total) * 100}%` as any, height: '100%', backgroundColor: '#FF5C1A', borderRadius: 999 }} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>{step + 1}/{total}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 22 }}>{children}</View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
        <TouchableOpacity onPress={canNext ? onNext : undefined} style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A', opacity: canNext ? 1 : 0.35 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{ctaLabel ?? 'Continuer'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OnboardingStep2() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    if (!selected || saving) return;
    setSaving(true);
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (uid) await supabase.from('user_profiles').update({ goal: selected }).eq('id', uid);
    setSaving(false);
    router.push('/(auth)/onboarding/step-3');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={!!selected && !saving}>
        <View style={{ marginTop: 18, marginBottom: 22 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Étape 1</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 30, letterSpacing: -0.5 }}>Quel est ton objectif principal ?</Text>
          <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, lineHeight: 20 }}>On adapte tout — programmes, conseils, nutrition.</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {OB_GOALS.map((g) => {
            const active = selected === g.id;
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => setSelected(g.id)}
                style={{
                  padding: 14, borderRadius: 16, marginBottom: 10,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  backgroundColor: active ? g.tint + '10' : theme.surface,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? g.tint : theme.border,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: g.tint + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={g.icon} size={20} color={g.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{g.label}</Text>
                  <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 2 }}>{g.sub}</Text>
                </View>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: active ? 6 : 1.5,
                  borderColor: active ? g.tint : theme.border,
                  backgroundColor: active ? '#fff' : 'transparent',
                }} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </OBShell>
    </SafeAreaView>
  );
}
```

### step-3.tsx — Niveau (fitness_level)

- [ ] **Step 3: Rewrite `step-3.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

const TOTAL = 8;
const STEP = 2;

const LEVELS = [
  { id: 'beginner',     label: 'Débutant',      sub: '<6 mois ou reprise après pause' },
  { id: 'intermediate', label: 'Intermédiaire', sub: '6 mois – 2 ans, technique propre' },
  { id: 'advanced',     label: 'Confirmé',      sub: '2+ ans, programmes structurés' },
];

function OBShell({ step, total, onBack, onNext, canNext, children }: any) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <TouchableOpacity onPress={onBack} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.text + '10', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, height: 4, backgroundColor: theme.text + '14', borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ width: `${((step + 1) / total) * 100}%` as any, height: '100%', backgroundColor: '#FF5C1A', borderRadius: 999 }} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>{step + 1}/{total}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 22 }}>{children}</View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
        <TouchableOpacity onPress={canNext ? onNext : undefined} style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A', opacity: canNext ? 1 : 0.35 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Continuer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OnboardingStep3() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    if (!selected || saving) return;
    setSaving(true);
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (uid) await supabase.from('user_profiles').update({ fitness_level: selected }).eq('id', uid);
    setSaving(false);
    router.push('/(auth)/onboarding/step-4');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={!!selected && !saving}>
        <View style={{ marginTop: 18, marginBottom: 22 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Étape 2</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 30, letterSpacing: -0.5 }}>Quel est ton niveau ?</Text>
          <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, lineHeight: 20 }}>Pour calibrer l'intensité et la complexité des séances.</Text>
        </View>
        <View style={{ gap: 10 }}>
          {LEVELS.map((lvl) => {
            const active = selected === lvl.id;
            return (
              <TouchableOpacity
                key={lvl.id}
                onPress={() => setSelected(lvl.id)}
                style={{
                  padding: 18, borderRadius: 16,
                  backgroundColor: active ? '#FF5C1A' + '10' : theme.surface,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? '#FF5C1A' : theme.border,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{lvl.label}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 3 }}>{lvl.sub}</Text>
                </View>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: active ? 6 : 1.5,
                  borderColor: active ? '#FF5C1A' : theme.border,
                  backgroundColor: active ? '#fff' : 'transparent',
                }} />
              </TouchableOpacity>
            );
          })}
        </View>
      </OBShell>
    </SafeAreaView>
  );
}
```

### step-4.tsx — Fréquence (workout_frequency)

- [ ] **Step 4: Rewrite `step-4.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

const TOTAL = 8;
const STEP = 3;

const FREQS = [
  { id: '2', label: '2 fois / semaine', sub: 'Entrainement léger, début progressif' },
  { id: '3', label: '3 fois / semaine', sub: 'Le sweet spot pour la plupart' },
  { id: '4', label: '4 fois / semaine', sub: 'Programme structuré par groupes' },
  { id: '5+', label: '5+ fois / semaine', sub: 'Haute fréquence, récup optimale' },
];

function OBShell({ step, total, onBack, onNext, canNext, children }: any) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <TouchableOpacity onPress={onBack} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.text + '10', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, height: 4, backgroundColor: theme.text + '14', borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ width: `${((step + 1) / total) * 100}%` as any, height: '100%', backgroundColor: '#FF5C1A', borderRadius: 999 }} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>{step + 1}/{total}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 22 }}>{children}</View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
        <TouchableOpacity onPress={canNext ? onNext : undefined} style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A', opacity: canNext ? 1 : 0.35 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Continuer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OnboardingStep4() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    if (!selected || saving) return;
    setSaving(true);
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (uid) await supabase.from('user_profiles').update({ workout_frequency: selected }).eq('id', uid);
    setSaving(false);
    router.push('/(auth)/onboarding/step-5');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={!!selected && !saving}>
        <View style={{ marginTop: 18, marginBottom: 22 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Étape 3</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 30, letterSpacing: -0.5 }}>Combien de fois par semaine ?</Text>
          <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, lineHeight: 20 }}>Pour construire un programme adapté à ton rythme.</Text>
        </View>
        <View style={{ gap: 10 }}>
          {FREQS.map((f) => {
            const active = selected === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setSelected(f.id)}
                style={{
                  padding: 18, borderRadius: 16,
                  backgroundColor: active ? '#FF5C1A' + '10' : theme.surface,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? '#FF5C1A' : theme.border,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{f.label}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 3 }}>{f.sub}</Text>
                </View>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: active ? 6 : 1.5,
                  borderColor: active ? '#FF5C1A' : theme.border,
                  backgroundColor: active ? '#fff' : 'transparent',
                }} />
              </TouchableOpacity>
            );
          })}
        </View>
      </OBShell>
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 6: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(auth)'/onboarding/step-1.tsx apps/mobile/app/'(auth)'/onboarding/step-2.tsx apps/mobile/app/'(auth)'/onboarding/step-3.tsx apps/mobile/app/'(auth)'/onboarding/step-4.tsx && rtk git commit -m "feat(onboarding): steps 1-4 — welcome hero, goal, level, frequency"
```

---

## Task 5: Onboarding Steps 5–8 (Equipment, Bio, Prep, Ready)

### step-5.tsx — Équipement

- [ ] **Step 1: Rewrite `step-5.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

const TOTAL = 8;
const STEP = 4;

const EQUIP = [
  { id: 'gym',        label: 'Salle complète',  sub: 'Barres, machines, racks',      icon: 'barbell-outline' as const },
  { id: 'home',       label: 'Home gym',        sub: 'Haltères, banc, élastiques',   icon: 'scale-outline' as const },
  { id: 'bodyweight', label: 'Poids du corps',  sub: 'Tractions, dips, push-ups',    icon: 'person-outline' as const },
  { id: 'outdoor',    label: 'Extérieur',       sub: 'Course, parc, calisthénie',    icon: 'walk-outline' as const },
];

function OBShell({ step, total, onBack, onNext, canNext, children }: any) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <TouchableOpacity onPress={onBack} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.text + '10', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, height: 4, backgroundColor: theme.text + '14', borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ width: `${((step + 1) / total) * 100}%` as any, height: '100%', backgroundColor: '#FF5C1A', borderRadius: 999 }} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>{step + 1}/{total}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 22 }}>{children}</View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
        <TouchableOpacity onPress={canNext ? onNext : undefined} style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A', opacity: canNext ? 1 : 0.35 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Continuer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OnboardingStep5() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    if (!selected || saving) return;
    setSaving(true);
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (uid) await supabase.from('user_profiles').update({ equipment: selected }).eq('id', uid);
    setSaving(false);
    router.push('/(auth)/onboarding/step-6');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={!!selected && !saving}>
        <View style={{ marginTop: 18, marginBottom: 22 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Étape 4</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 30, letterSpacing: -0.5 }}>Quel équipement as-tu ?</Text>
          <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, lineHeight: 20 }}>Pour proposer les bons exercices et alternatives.</Text>
        </View>
        <View style={{ gap: 10 }}>
          {EQUIP.map((eq) => {
            const active = selected === eq.id;
            return (
              <TouchableOpacity
                key={eq.id}
                onPress={() => setSelected(eq.id)}
                style={{
                  padding: 14, borderRadius: 16,
                  backgroundColor: active ? '#FF5C1A' + '10' : theme.surface,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? '#FF5C1A' : theme.border,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FF5C1A' + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={eq.icon} size={20} color="#FF5C1A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{eq.label}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 3 }}>{eq.sub}</Text>
                </View>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: active ? 6 : 1.5,
                  borderColor: active ? '#FF5C1A' : theme.border,
                  backgroundColor: active ? '#fff' : 'transparent',
                }} />
              </TouchableOpacity>
            );
          })}
        </View>
      </OBShell>
    </SafeAreaView>
  );
}
```

### step-6.tsx — Bio (âge, poids, taille) — NEW FILE

- [ ] **Step 2: Create `step-6.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

const TOTAL = 8;
const STEP = 5;

function OBShell({ step, total, onBack, onNext, canNext, children }: any) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <TouchableOpacity onPress={onBack} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.text + '10', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, height: 4, backgroundColor: theme.text + '14', borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ width: `${((step + 1) / total) * 100}%` as any, height: '100%', backgroundColor: '#FF5C1A', borderRadius: 999 }} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>{step + 1}/{total}</Text>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
        <TouchableOpacity onPress={canNext ? onNext : undefined} style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A', opacity: canNext ? 1 : 0.35 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Continuer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OnboardingStep6() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = age.length > 0 && weight.length > 0 && height.length > 0;

  const handleNext = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (uid) {
      await supabase.from('user_profiles').update({
        age: parseInt(age, 10),
        weight_kg: parseFloat(weight),
        height_cm: parseFloat(height),
      }).eq('id', uid);
    }
    setSaving(false);
    router.push('/(auth)/onboarding/step-7');
  };

  const fieldStyle = {
    backgroundColor: theme.surface,
    borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    paddingHorizontal: 14, paddingVertical: 14,
    color: theme.text, fontSize: 14,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={handleNext} canNext={isValid && !saving}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}>
            <View style={{ marginTop: 18, marginBottom: 22 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Étape 5</Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 30, letterSpacing: -0.5 }}>Quelques infos sur toi</Text>
              <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, lineHeight: 20 }}>Pour calibrer tes objectifs caloriques et ta progression.</Text>
            </View>
            <View style={{ gap: 16 }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Âge</Text>
                <TextInput value={age} onChangeText={setAge} placeholder="25" placeholderTextColor={theme.muted} keyboardType="number-pad" style={fieldStyle} />
              </View>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Poids (kg)</Text>
                <TextInput value={weight} onChangeText={setWeight} placeholder="75" placeholderTextColor={theme.muted} keyboardType="decimal-pad" style={fieldStyle} />
              </View>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' }}>Taille (cm)</Text>
                <TextInput value={height} onChangeText={setHeight} placeholder="175" placeholderTextColor={theme.muted} keyboardType="decimal-pad" style={fieldStyle} />
              </View>
            </View>
          </ScrollView>
        </OBShell>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

### step-7.tsx — Préparation / Résumé — NEW FILE

- [ ] **Step 3: Create `step-7.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';

const TOTAL = 8;
const STEP = 6;

function OBShell({ step, total, onBack, onNext, children }: any) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <TouchableOpacity onPress={onBack} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.text + '10', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, height: 4, backgroundColor: theme.text + '14', borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ width: `${((step + 1) / total) * 100}%` as any, height: '100%', backgroundColor: '#FF5C1A', borderRadius: 999 }} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>{step + 1}/{total}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 22 }}>{children}</View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 22, paddingTop: 10 }}>
        <TouchableOpacity onPress={onNext} style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#FF5C1A' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Tout est bon !</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OnboardingStep7() {
  const theme = useThemeStore((s) => s.theme);

  const items = [
    { icon: 'checkmark-circle-outline' as const, color: '#2E9E5B', text: 'Ton objectif et ton niveau enregistrés' },
    { icon: 'checkmark-circle-outline' as const, color: '#2E9E5B', text: 'Fréquence et équipement configurés' },
    { icon: 'checkmark-circle-outline' as const, color: '#2E9E5B', text: 'Profil morphologique créé' },
    { icon: 'sparkles-outline' as const, color: '#FF5C1A', text: 'Le Coach IA va personnaliser ton plan' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <OBShell step={STEP} total={TOTAL} onBack={() => router.back()} onNext={() => router.push('/(auth)/onboarding/step-8')}>
        <View style={{ marginTop: 18, marginBottom: 28 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: '#FF5C1A', marginBottom: 8 }}>Préparation</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, lineHeight: 30, letterSpacing: -0.5 }}>Ton profil est prêt</Text>
          <Text style={{ fontSize: 14, color: theme.muted, marginTop: 8, lineHeight: 20 }}>Voici ce qu'on a configuré pour toi.</Text>
        </View>

        {/* Summary card */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: 20,
          borderWidth: 1, borderColor: theme.border, padding: 20, gap: 14,
        }}>
          {items.map((item) => (
            <View key={item.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 11,
                backgroundColor: item.color + '18',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={{ fontSize: 14, color: theme.text, flex: 1, lineHeight: 19 }}>{item.text}</Text>
            </View>
          ))}
        </View>
      </OBShell>
    </SafeAreaView>
  );
}
```

### step-8.tsx — Prêt / Done — NEW FILE

- [ ] **Step 4: Create `step-8.tsx`**

Sets `onboarding_done: true` and navigates to `/(app)`.

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';

export default function OnboardingStep8() {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const uid = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        await supabase.from('user_profiles').update({ onboarding_done: true }).eq('id', uid);
      }
      await refreshProfile();
      router.replace('/(app)');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: 'center', alignItems: 'flex-start' }}>
        {/* Progress — full */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, position: 'absolute', top: 14, left: 14, right: 14 }}>
          <View style={{ width: 32, height: 32 }} />
          <View style={{ flex: 1, height: 4, backgroundColor: '#FF5C1A', borderRadius: 999 }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>8/8</Text>
        </View>

        {/* Icon */}
        <View style={{
          width: 76, height: 76, borderRadius: 22,
          backgroundColor: '#FF5C1A',
          alignItems: 'center', justifyContent: 'center', marginBottom: 24,
        }}>
          <Ionicons name="trophy" size={36} color="#fff" />
        </View>

        <Text style={{ fontSize: 40, fontWeight: '800', color: theme.text, lineHeight: 42, letterSpacing: -1, marginBottom: 14 }}>
          {'C\'est parti\nsur Ziko.'}
        </Text>
        <Text style={{ fontSize: 15, color: theme.muted, lineHeight: 22, marginBottom: 32 }}>
          Ton coach IA a tout en main. Première séance, on y va.
        </Text>

        {/* Benefits */}
        <View style={{ gap: 12, marginBottom: 40, width: '100%' }}>
          {[
            { icon: 'flash-outline' as const,    text: 'Programme IA généré selon ton profil' },
            { icon: 'barbell-outline' as const,  text: 'Suivi de séances en temps réel' },
            { icon: 'heart-outline' as const,    text: 'Nutrition, sommeil, mesures — tout intégré' },
          ].map((b) => (
            <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: '#FF5C1A' + '18', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={b.icon} size={16} color="#FF5C1A" />
              </View>
              <Text style={{ fontSize: 14, color: theme.text, flex: 1 }}>{b.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={handleStart}
          disabled={isLoading}
          style={{
            paddingVertical: 18, borderRadius: 18,
            backgroundColor: '#FF5C1A', alignItems: 'center',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
            {isLoading ? 'Chargement…' : 'Commencer'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: Type-check — must be clean**

```bash
cd /c/ziko-platform && npm run type-check 2>&1 | grep "error TS" | head -30
```

Common fixes:
- If `width: \`${...}%\` as any` causes TS errors, type it as `{ width: string }` via a cast
- If `Ionicons name` prop fails, check the icon name exists in `@expo/vector-icons/Ionicons`

- [ ] **Step 6: Commit**

```bash
cd /c/ziko-platform && rtk git add apps/mobile/app/'(auth)'/onboarding/step-5.tsx apps/mobile/app/'(auth)'/onboarding/step-6.tsx apps/mobile/app/'(auth)'/onboarding/step-7.tsx apps/mobile/app/'(auth)'/onboarding/step-8.tsx && rtk git commit -m "feat(onboarding): steps 5-8 — equipment, bio, prep summary, ready/done"
```

---

## Self-Review

**Spec §7 — Auth screens:**
- `welcome.tsx` dark hero ✅ · Apple/Google CTAs (only Google implemented — Apple requires native setup) ✅ · "Continuer avec email" → register ✅ · "Connecte-toi" → login ✅
- `login.tsx` back chevron ✅ · eyebrow + title ✅ · show/hide password ✅ · forgot link → `/(auth)/forgot` ✅
- `register.tsx` back chevron ✅ · password strength bar ✅ · routes to step-1 after signup ✅
- `forgot.tsx` sent state with success card ✅ · Resend link ✅

**Spec §7 — Onboarding 8 steps:**
- step-1 Welcome hero with bullets ✅
- step-2 Goal selection → saves `goal` ✅ (5 options incl. strength + health)
- step-3 Level selection → saves `fitness_level` ✅
- step-4 Frequency selection → saves `workout_frequency` ✅
- step-5 Equipment selection → saves `equipment` ✅
- step-6 Bio (age, weight, height) → saves to existing columns ✅
- step-7 Prep summary card ✅
- step-8 Ready → sets `onboarding_done: true` → `/(app)` ✅

**Progress bar:** Animated width via `((step+1)/total)*100%` — all steps ✅
**DB:** Migration 022 adds `fitness_level`, `workout_frequency`, `equipment` + extends goal CHECK ✅
**Auth layout:** `welcome` + `forgot` registered ✅
**showAlert:** Used for errors in auth screens ✅ · No `Alert` from RN ✅
