# Ziko v2 — Design Integration Spec

_Date: 2026-05-09_

## Contexte

Intégration de la maquette HTML/CSS/JSX (Claude Design) dans l'app Expo React Native.
Approche : **Design System First**, puis écrans par ordre d'impact.

---

## Décisions actées

| # | Sujet | Décision |
|---|-------|----------|
| 1 | Tab bar | **4 tabs** — Home, Séance, Store (redesigné), Profil |
| 2 | Forme du jour | **Anneau composite + breakdown liste** (comme maquette) |
| 3 | Calendar strip sur Home | **Supprimée** → Calendar screen dédié |
| 4 | Bug FAB | **Gardé** — repositionné bottom-right, couleur dark/charcoal, 42×42 |
| 5 | Chat FAB | **Supprimé** — AI accessible via Coach inline + screen dédié |
| 6 | Drawer "Tous mes outils" | **Gardé sur Home** même avec le Store tab |
| 7 | Onboarding | **Complet redesign** — 8 steps (Welcome→Objectif→Niveau→Fréquence→Équipement→Bio→Prep→Ready) |
| 8 | Paywall | **Intégré UI** — Free/Premium/À vie, prix en placeholders à confirmer |
| 9 | Table des niveaux | **Sous-page "Progression"** accessible depuis la carte identité |
| 10 | Auth screens | **Complet redesign** — Welcome, Sign in, Sign up, Forgot |
| 11 | Stats Profil | **Totaux entraînement + morpho** (les deux, totaux en premier) |

---

## Phase 1 — Design System

### 1.1 ThemePalette — nouveaux tokens

Étendre l'interface `ThemePalette` dans `packages/plugin-sdk/src/theme.ts` :

```ts
// Tokens sémantiques additionnels
success: string;       // ex: #2E9E5B
info: string;          // ex: #2E7BF6
violet: string;        // ex: #7B5BD0
warn: string;          // ex: #E8A33A
cardDark: string;      // surface foncée (identity card, mission card) — ex: #1C1A17
cardDarkText: string;  // texte sur cardDark — ex: #FFFAF6
```

Mettre à jour **tous les 7 themes** dans `THEME_REGISTRY` avec ces valeurs cohérentes.

### 1.2 Typographie

Installer `@expo-google-fonts/manrope` et `@expo-google-fonts/geist` (ou équivalent disponible).
- **Display / titres** : Manrope (700, 800)
- **Body / interface** : Geist (400, 500, 600)
- Ajouter `fontDisplay` et `fontBody` dans `ThemePalette`

### 1.3 Card styles

Ajouter `cardStyle: 'flat' | 'shadow' | 'outlined'` dans `ThemePalette`.
- `flat` : border 1px `border`, no shadow
- `shadow` : border transparent, shadow `0 1px 2px rgba(28,26,23,.04), 0 8px 24px -12px rgba(28,26,23,.08)`
- `outlined` : border 1.5px `text`, no shadow

Le theme par défaut → `shadow`.

### 1.4 Composants UI partagés (`packages/ui`)

Mettre à jour les composants existants pour utiliser les nouveaux tokens :
- `Card` : appliquer `cardStyle` du theme
- `Button` : utiliser `theme.primary`, `theme.cardDark`
- `ProgressBar` : utiliser les couleurs sémantiques
- `Badge`, `Tag` : utiliser `success`, `info`, `violet`, `warn`
- Supprimer toutes les couleurs hardcodées des composants partagés

### 1.5 DB — Default theme pré-débloqué

Migration Supabase : tous les users ont le theme `default` (`Sport Orange`) déjà unlocked.

```sql
-- S'assurer que le theme default est unlocked pour tous
-- (selon la structure existante de la table gamification/shop)
```

Vérifier la table concernée (`shop_items` ou `user_inventory`) et ajouter une migration qui insère l'item `default` pour tous les `user_profiles` existants + le rend gratuit/auto-unlock à la création de compte.

---

## Phase 2 — Home Screen (`apps/mobile/app/(app)/index.tsx`)

### Suppressions
- Weekly calendar strip (7 jours) → remplacée par Calendar screen dédié
- 4 wellness cards séparées (sleep, hydration, mood, weight)
- Grille plugins permanente
- 6 quick action buttons

### Nouveaux composants

**`FormeDuJour`** — anneau SVG composite
- Score 0–100 agrégé depuis : sleep_recovery_pct, hydration_pct, nutrition_pct, load_score
- 4 segments colorés (violet/info/primary/success) + score central
- Breakdown liste à droite (icon + label + valeur + sub)
- Tap sur l'anneau → expand/collapse détail

**`MissionCard`** — hero card sombre
- Background `theme.cardDark`
- Programme actif + workout du jour
- CTA "Allez, c'est parti !"
- Tag duration + nombre d'exercices

**`AICoachInline`**
- Icône sparkles sur fond `theme.cardDark`
- Tip contextuel rotatif (pre-séance / hydratation / récup…)
- Badge crédits restants (ex: ⚡ 47)
- CTA "J'applique" / "Plus tard"

**`QuickLogRow`**
- 4 boutons 1-tap : Eau / Humeur / Poids / Repas
- Ouvre un bottom sheet minimal pour saisie rapide

**`PluginsDrawer`**
- Bouton "Mes outils" → bottom sheet
- Grille 4 colonnes de tous les plugins installés
- Tap → navigation vers le plugin

### Layout final Home (top → bottom)
1. Header greeting + streak chip
2. FormeDuJour card
3. AICoachInline card
4. MissionCard (workout du jour)
5. QuickLogRow
6. Section "Récentes" (3 dernières séances compactes)
7. Bouton "Tous mes outils" → PluginsDrawer

---

## Phase 3 — Séance Tab (`apps/mobile/app/(app)/workout/index.tsx`)

### Suppressions
- RPE shortcut banner
- Supplements tip banner

### Nouveaux composants

**Header** : "Au boulot." avec bouton calendar (→ CalendarScreen)

**`ResumeBar`** — si session en cours
- Hero card sombre, CTA "Reprendre"

**`ProgramCard`**
- Grille hebdo (jours colorés par statut)
- Nom du programme + workout du jour

**`StartModes`** — 3 cards horizontales
- Mission du jour | Libre | Coach IA

**`WorkoutHistory`** — liste compacte avec PR badges

---

## Phase 4 — Profil (`apps/mobile/app/(app)/profile/index.tsx`)

### Suppressions
- Level progression table (→ sous-page Progression)

### Nouveaux composants

**`IdentityCard`** — dark hero
- Background `theme.cardDark`
- Avatar initiales + gradient orange
- Name + handle + joinDate
- Level + XP bar + streak chip inline
- Bouton "Modifier" → AvatarUploadScreen

**`TotalsRow`** — 3 cards
- Séances (année) | Volume (tonnes) | Temps (heures)

**`MorphoRow`** — 3 cards sous les totals
- Poids | Taille | Âge (données profil)

**`CreditsCard`**
- Balance X/100, barre de progression
- Recharge dans N jours
- Historique 3 dernières utilisations
- CTA "+ Recharger" → RechargeSheet

**`PRsList`** — records personnels
- Par lift, avec delta ↑+X kg et date
- Tap → LiftDetailScreen

**`GoalsList`** — objectifs
- Progress bar par objectif
- Tap → GoalEditScreen
- Bouton "+" pour créer

**`ProgressionScreen`** (sous-page)
- Table des 12 premiers niveaux (déplacée depuis profil)

---

## Phase 5 — Store Tab (`apps/mobile/app/(app)/store/`)

Refonte complète selon `StoreScreen` du design :
- Filter tabs : Tous | Training | Nutrition | Santé | Coaching | Social
- Toggle Installés/Disponibles
- Cards avec : icon, nom, catégorie, rating ★, nb users, description, prix, badge Premium
- Featured plugins en haut (2 en highlight)
- Bouton Install/Désinstaller inline

---

## Phase 6 — Nouveaux écrans

Tous créés en tant que screens Expo Router ou modals/sheets selon le cas :

| Écran | Route / type | Source design |
|-------|-------------|---------------|
| CalendarScreen | Modal depuis Séance header | `extras.jsx > CalendarScreen` |
| PaywallScreen | Full-screen modal global | `paywall.jsx > PaywallScreen` |
| RechargeSheet | Bottom sheet global | `paywall.jsx > RechargeSheet` |
| NotificationsScreen | Push screen | `notifications.jsx` |
| SearchOverlay | Overlay global | `extras-3.jsx > SearchOverlay` |
| HelpScreen | Push screen | `extras.jsx > HelpScreen` |
| LegalScreen | Push screen | `extras.jsx > LegalScreen` |
| ReferralScreen | Push screen | `extras.jsx > ReferralScreen` |
| DeviceDetailScreen | Push screen | `extras.jsx > DeviceDetailScreen` |
| LiftDetailScreen | Push screen | `extras-2.jsx > LiftDetailScreen` |
| GoalEditScreen | Push screen | `extras-2.jsx > GoalEditScreen` |
| PostDetailScreen | Push screen | `extras-2.jsx > PostDetailScreen` |
| AvatarUploadScreen | Push screen | `extras-3.jsx > AvatarUploadScreen` |
| AIChatScreen | Push screen (enrichi) | `extras-3.jsx > AIChatScreen` |
| ErrorScreen | Composant (3 variantes) | `extras.jsx > ErrorScreen` |
| ProgressionScreen | Sous-page Profil | table niveaux déplacée |
| ProgramBuilderScreen | Screen dédié | `extras-2.jsx > ProgramBuilderScreen` |

---

## Phase 7 — Auth & Onboarding

### Auth (`apps/mobile/app/(auth)/`)
Redesign complet des screens existants + nouvel écran Welcome :
- `welcome.tsx` (nouveau) — dark hero, CTA Sign in / Sign up
- `login.tsx` — redesign avec nouveau style
- `register.tsx` — redesign
- `forgot.tsx` (nouveau) — mot de passe oublié

### Onboarding (`apps/mobile/app/(auth)/onboarding/`)
8 steps (step-1 à step-8) redesignés :
1. Welcome — hero animé
2. Objectif — muscle / perte de poids / endurance / santé
3. Niveau — débutant / intermédiaire / avancé
4. Fréquence — 2/3/4/5+ jours/semaine
5. Équipement — salle complète / haltères / bodyweight / hyrox
6. Bio — poids, taille, âge
7. Préparation — résumé du profil créé
8. Prêt — CTA "Commencer"

Progress bar animée tout au long.

---

## Phase 8 — Bug FAB

Modifier `BugReportFAB` dans `apps/mobile/app/(app)/_layout.tsx` :
- Position : bottom **right** (pas left)
- Couleur : `theme.cardDark` (dark/charcoal, pas rouge)
- Taille : 42×42 (pas 44×44)
- Opacité : 0.92, transition spring
- Supprimer `ChatFAB` complètement

---

## Ordre d'implémentation recommandé

```
Phase 1 → Phase 2 → Phase 4 → Phase 3 → Phase 5 → Phase 6 → Phase 7 → Phase 8
Design   Home       Profil     Séance    Store      Nouveaux   Auth/OB   FAB
System                                             écrans
```

---

## Fichiers source design (référence)

Tous dans le bundle `index.html` à la racine du projet :
- `bundle.jsx` — Home, Workout, Profile, App router
- `plugins.jsx` / `plugins-2.jsx` — PluginPage
- `extras.jsx` — Calendar, Help, Legal, Device, Referral, Search, Error
- `extras-2.jsx` — PostDetail, ChallengeDetail, LiftDetail, GoalEdit, ProgramBuilder
- `extras-3.jsx` — Store, AIChat, CommunityChat, AvatarUpload
- `tweaks-panel.jsx` — panneau tweaks (inspiration pour settings)
- `bug-report.jsx` — BugFab + BugSheet
- `paywall.jsx` — PaywallScreen + RechargeSheet
- `onboarding.jsx` — 8 steps OB
- `auth.jsx` — AuthWelcome, AuthSignin, AuthSignup, AuthForgot
- `notifications.jsx` — NotificationsScreen
- `profile.jsx` — PRStats, Progress, Badges tabs
- `settings.jsx` — NotifSubScreen, AppearanceSubScreen, IntegrationsSubScreen
- `workout-active.jsx`, `workout-rest-summary.jsx`, `workout-detail-picker.jsx`, `workout-program-ai.jsx`
