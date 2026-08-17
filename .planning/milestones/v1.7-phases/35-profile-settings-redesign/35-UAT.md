---
status: complete
phase: 35-profile-settings-redesign
source: 35-01-SUMMARY.md, 35-02-SUMMARY.md, 35-03-SUMMARY.md, 35-04-SUMMARY.md, 35-06-SUMMARY.md, 35-07-SUMMARY.md, 35-08-SUMMARY.md, 35-09-SUMMARY.md, 35-10-SUMMARY.md, 35-11-SUMMARY.md, 35-12-SUMMARY.md, 35-13-SUMMARY.md, 35-14-SUMMARY.md, 35-15-SUMMARY.md, 35-G02-SUMMARY.md, 35-G04-SUMMARY.md, 35-G05-SUMMARY.md, 35-G06-SUMMARY.md
started: 2026-05-25T00:00:00Z
updated: 2026-05-25T00:01:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Profile Hero & Layout
expected: Open the Profile tab. A 160px gradient banner appears at the top (dark orange gradient), with an 84px avatar overlapping it by ~44px from below. Below the avatar: your name, then a row showing three counters — ABONNÉS, ABONNEMENTS, SEMAINES — with real values from the DB. A 3-tab bar shows: Stats · Progrès · Badges.
result: pass

### 2. Profile Stats Tab
expected: Tap the Stats tab. You see 4 stat cards arranged in a 2×2 grid: Séances totales, Jours d'affilée, PR battus, Semaines actives — all showing real numbers (not 0/0). Below the grid, a "PR récents" card lists up to 3 exercises with max weight.
result: pass

### 3. Profile Progrès Tab — Gallery
expected: Tap the Progrès tab. A 2-column grid of progress photos appears (or an empty state). A dashed "Ajouter" card is always visible. Tapping Ajouter opens the photo picker; selecting a photo uploads it and it appears in the gallery. Long-pressing an existing photo shows a Supprimer option that removes it.
result: pass

### 4. Profile Badges Tab — Real Data
expected: Tap the Badges tab. The header shows "X obtenus · Y à débloquer" with real counts. 11 badges total are visible. Earned badges display in full color with their emoji; unearned badges are greyed out (opacity ~0.4) with a lock icon. If you have at least 1 workout session, the first_session badge should be earned.
result: pass

### 5. Edit Profile Form & Avatar Upload
expected: In Settings (or via profile), tap "Informations personnelles" — it navigates to the Edit screen (no "bientôt disponible" alert). The form is pre-filled with your name, bio, handle (@tonpseudo), and goal. Saving updates persist (visible after going back). Tapping the avatar shows camera/galerie options; uploading replaces the avatar image.
result: pass

### 6. Settings Screen Layout
expected: Open Settings from Profile. The main screen shows an account card at top (avatar, name, email) with a PREMIUM or FREE badge. Below: 4 groups — Compte (4 rows), Abonnement (4 rows), Préférences (5 rows), Aide & infos (5 rows). A red "Se déconnecter" button at the bottom, and a "Ziko · v2.4.1 · build 8842" footer.
result: pass

### 7. Notifications Toggles — DB Persistence
expected: In Settings, tap "Notifications". The 9 toggles load from the DB (brief loading indicator before showing). Toggling any switch saves to Supabase after ~500ms. Kill and reopen the app — the toggle states are preserved exactly as set.
result: pass

### 8. Appearance — Units, Langue, Région
expected: In Settings, tap "Apparences". Unit selection (Métrique / Impérial) persists to DB — changing it should affect weight display in the Measurements plugin and distance display in the Cardio plugin. Langue (fr/en) and Région pickers open bottom-sheet selectors and save to DB. No theme carousel is shown (removed).
result: pass

### 9. Integrations — Live Connection State
expected: In Settings, tap "Intégrations". The screen shows 6 integration cards (Strava, Garmin, Apple Health, etc.). Cards connected via health_sync_log show a green dot. The Apple Health "Connecter" button on iOS should open the iOS Health settings (not just a "bientôt" alert). The Integrations badge in the main settings shows the live connected count.
result: pass

### 10. Security — Password Change (No Infinite Spinner)
expected: In Settings, tap "Mot de passe" (or "Sécurité"). Enter a new password < 8 chars — an inline counter shows "X/8" in red. Enter matching passwords (≥ 8 chars) and tap save. The button shows a spinner briefly, then either confirms success or shows an error — the spinner always stops (never stays stuck).
result: pass

### 11. Privacy Toggles — Persistence
expected: In the Security screen, the "Profil public" toggle loads from DB (not always defaulting to ON). Toggling off and reopening the screen shows the toggle still off. Toggling on also persists. The two other toggles (Afficher mes stats, Afficher mes activités) also persist across sessions.
result: pass

### 12. Help Screen — FAQ
expected: In Settings, tap "Centre d'aide". An FAQ screen opens with 4 collapsible groups: Démarrage, Séances, Abonnement, Compte. Tapping a question expands the answer. Tapping again collapses it. Content is in French, no lorem ipsum.
result: pass

### 13. Legal Screen — 3 Tabs
expected: In Settings, tap "Mentions légales". A screen opens with 3 tabs: Mentions légales, CGU, Confidentialité. Each tab has real French legal content (not empty). Switching tabs resets scroll to top. The CGU tab has an orange-tinted AI health warning box.
result: pass

### 14. Referral Screen — Share Code
expected: In Settings, tap "Parrainage" — it navigates to a dedicated Referral screen (not an inline alert). The screen has 2 tabs: "Parraine un ami" (shows your referral code = first 8 chars of userId in uppercase, and a share button that opens the native share sheet) and "Code promo" (a text input to enter and apply a promo code).
result: pass

### 15. AI Credits Balance — Live Data
expected: In Settings, find the "Crédits IA" row. It shows a live value like "47 / 100" (not hardcoded) fetched from the /credits/balance API. If the API is reachable, the value updates within ~1 minute of earning/spending credits.
result: pass

## Summary

total: 15
passed: 15
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
