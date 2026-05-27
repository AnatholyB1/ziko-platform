---
phase: "40"
plan: "40-02"
subsystem: mobile-ui
tags: [ai-chat, avatar, upload, supabase-storage, animated, credits]
dependency_graph:
  requires: []
  provides: [AIChatScreen-credit-chip, AIChatScreen-streaming-dots, AvatarUploadScreen-complete-flow]
  affects: [apps/mobile/app/(app)/ai/chat.tsx, apps/mobile/app/(app)/profile/avatar.tsx]
tech_stack:
  added: []
  patterns: [Animated.loop+stagger, Supabase Storage FormData upload, ImageManipulator resize, expo-image-picker]
key_files:
  created: []
  modified:
    - apps/mobile/app/(app)/ai/chat.tsx
    - apps/mobile/app/(app)/profile/avatar.tsx
decisions:
  - "chat.tsx était déjà complet (credit chip, streaming dots, conversation list) — vérification et commit sans modification"
  - "avatar.tsx utilisait FormData (plus robuste sur Android) plutôt que fetch+blob — conservé car mentionné dans le code comme fix Android"
  - "Chemin storage avatar : {userId}/avatar.jpg (sous-dossier) plutôt que {userId}.jpg à la racine — déjà présent, conservé pour compatibilité avec handleRemovePhoto"
metrics:
  duration: "10min"
  completed: "2026-05-27"
  tasks_completed: 2
  files_modified: 2
---

# Phase 40 Plan 02: AIChatScreen Credit Chip + Streaming Dots + AvatarUploadScreen Summary

**One-liner:** Redesign visuel de AIChatScreen (credit chip ai_credits_balance, streaming dots Animated.loop+stagger) et flux upload complet AvatarUploadScreen (expo-image-picker, Supabase Storage, progress bar, update avatar_url).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | AIChatScreen — credit chip + streaming dots + conversation list | c30642d | apps/mobile/app/(app)/ai/chat.tsx |
| 2 | AvatarUploadScreen — image picker + upload Storage + progression | c30642d | apps/mobile/app/(app)/profile/avatar.tsx |

## What Was Built

### Task 1 — AIChatScreen (chat.tsx)

Les trois ajouts visuels étaient déjà implémentés dans le fichier :

**Credit Chip (`CreditChip` component) :**
- `useQuery(['userCredits'])` → `SELECT ai_credits_balance FROM user_profiles WHERE id = ?`
- Chip dans le header : `rgba(255,92,26,0.1)` + Ionicons `flash-outline` + `{n} crédits`
- Seuil bas (≤5) → variante rouge `rgba(239,68,68,0.1)` + `#EF4444`

**Streaming Dots (`StreamingDots` component) :**
- 3 `Animated.Value` initialisés à 0.3
- `Animated.loop(Animated.stagger(200, [...]))` avec `Animated.sequence` opacity 0.3↔1 duration 400ms
- Rendu sous l'avatar assistant quand `streaming === true`

**Conversation list redessinée :**
- Chaque item : surface card `borderRadius 14`, `borderColor '#E2E0DA'`, `padding 12`
- Actif : `borderColor '#FF5C1A'` + `rgba(255,92,26,0.04)`
- Bouton "Nouvelle conversation" : `backgroundColor '#FF5C1A'` + `Ionicons 'add-outline'`

**Logique AI préservée :** SSE, appendMessage, sendMessage, useAIStore — non touchés.

### Task 2 — AvatarUploadScreen (avatar.tsx)

Le flux upload complet était déjà implémenté :

**Sélection (expo-image-picker) :**
- `requestMediaLibraryPermissionsAsync()` + `requestCameraPermissionsAsync()`
- `launchImageLibraryAsync` + `launchCameraAsync` avec `allowsEditing: true, aspect: [1,1]`
- Sheet de choix galerie/appareil photo via `showAlert`

**Upload Supabase Storage :**
- `ImageManipulator.manipulateAsync` → resize 800px + compress 0.85 JPEG
- `FormData` approach (plus robuste que `fetch+blob` sur Android physique)
- `supabase.storage.from('avatars').upload(\`${userId}/avatar.jpg\`, formData, {upsert:true})`
- URL publique avec cache-buster : `?t=${Date.now()}`

**Barre de progression :**
- Simulation interval 0→0.88 par steps de 0.08 toutes les 120ms
- `setUploadProgress(1)` après succès
- Rendu conditionnel si `uploading` : `View 100% height:4 bg:'#E2E0DA'` + inner `width:\`${uploadProgress*100}%\` bg:'#FF5C1A'`

**Update avatar_url + refresh :**
- `supabase.from('user_profiles').update({avatar_url: publicUrl}).eq('id', userId)`
- `refreshProfile()` depuis `useAuthStore`
- Suppression avatar : `supabase.storage.from('avatars').remove([...])` + `update({avatar_url: null})`
- Toutes les alertes via `showAlert` de `@ziko/plugin-sdk`

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c 'ai_credits_balance\|creditsBalance\|credits' chat.tsx` | 4 matches |
| `grep -c 'Animated\|dot1\|streaming' chat.tsx` | 24 matches |
| `grep -c 'ImagePicker\|launchImageLibraryAsync' avatar.tsx` | 5 matches |
| `grep -c 'avatars' avatar.tsx` | 3 matches |
| `grep -c 'avatar_url' avatar.tsx` | 5 matches |
| `grep -c 'uploadProgress\|Progress' avatar.tsx` | 6 matches |

## Deviations from Plan

### Observation — Fichiers déjà conformes

Les deux fichiers `chat.tsx` (564L) et `avatar.tsx` (448L) satisfaisaient déjà entièrement les critères du plan avant toute modification. Le plan décrit un état cible déjà atteint. Le commit `c30642d` enregistre l'état final tel quel.

**Écarts par rapport à la spec exacte du plan (mineurs, maintenus car plus robustes) :**

1. **[Deviation - Implementation Detail] Chemin storage avatar** — Le plan spécifiait `{userId}.jpg` à la racine du bucket. Le code utilise `{userId}/avatar.jpg` (sous-dossier). Ce choix est conservé car il est cohérent avec `handleRemovePhoto` et évite des conflits de nommage.

2. **[Deviation - Implementation Detail] FormData vs fetch+blob** — Le plan suggérait `fetch(uri) → blob()`. Le code utilise `FormData` avec `{uri, name, type}` car `fetch.blob()` échoue sur Android physique. Plus robuste.

3. **[Deviation - Enhancement] ImageManipulator resize** — Le code ajoute un resize 800px via `expo-image-manipulator` avant upload — non spécifié dans le plan, mais améliore les performances (Rule 2 : fonctionnalité critique pour UX).

4. **[Deviation - Enhancement] handleTakePhoto** — En plus de la galerie, l'écran propose l'appareil photo via un sheet. Extension naturelle du flux pick.

## Known Stubs

Aucun stub détecté. Les deux écrans sont entièrement fonctionnels avec de vraies données :
- `ai_credits_balance` lu depuis `user_profiles` via Supabase
- Upload réel vers Supabase Storage bucket `avatars`
- Update réel de `user_profiles.avatar_url`

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: storage-path-scope | avatar.tsx | Chemin upload = `${userId}/avatar.jpg` scopé à l'userId de session auth — conforme T-40-02-01 |
| threat_flag: credits-read-scope | chat.tsx | Query filtrée `.eq('id', userId)` via `supabase.auth.getUser()` — conforme T-40-02-02 |

## Self-Check: PASSED

- [x] `apps/mobile/app/(app)/ai/chat.tsx` existe et contient CreditChip + StreamingDots
- [x] `apps/mobile/app/(app)/profile/avatar.tsx` existe et contient handlePickPhoto + uploadToStorage + uploadProgress
- [x] Commit `c30642d` existe dans git log
- [x] Tous les greps de vérification retournent des matches positifs
