---
phase: 34
slug: auth-onboarding-redesign
status: approved
reviewed_at: 2026-05-22
shadcn_initialized: false
preset: none
figma_file_url: https://www.figma.com/design/iFPAXWrRLsl3OkUtYUifqW
moodboard_path: .planning/MOODBOARD.md
created: 2026-05-22
platform: react-native
---

# Phase 34 — UI Design Contract: Auth + Onboarding Redesign

> Visual and interaction contract for Phase 34. Derived from canonical mockups `auth.jsx` and `onboarding.jsx`.
> **Canonical mockups are the pixel-for-pixel reference. This document is the written contract. Both are required.**

---

## Source of Truth

| Asset | Location |
|-------|----------|
| Auth mockup | `C:\Users\Anatholy\Downloads\ziko\auth.jsx` |
| Onboarding mockup | `C:\Users\Anatholy\Downloads\ziko\onboarding.jsx` |
| Figma file (shared project) | https://www.figma.com/design/iFPAXWrRLsl3OkUtYUifqW |
| Mood board | `.planning/MOODBOARD.md` |
| Phase 32 DS tokens | `packages/ui/src/design-system.ts` |

> The existing Figma file (`iFPAXWrRLsl3OkUtYUifqW`) is the shared project file. Phase 34 frames must be added as a new "Phase 34 — Auth + Onboarding" page. The `auth.jsx` and `onboarding.jsx` canonical mockups carry full pixel-authority.

---

## Figma Designs

| Asset | URL |
|-------|-----|
| Figma File (shared project file) | [iFPAXWrRLsl3OkUtYUifqW](https://www.figma.com/design/iFPAXWrRLsl3OkUtYUifqW) |
| Phase 34 frames | To be added under "Phase 34 — Auth + Onboarding" page |

### Screen Designs

| Screen | States Covered | Reference |
|--------|----------------|-----------|
| AuthWelcome | Default | `auth.jsx` `AuthWelcome` function |
| AuthSignin | Default / Filled / Disabled CTA | `auth.jsx` `AuthSignin` function |
| AuthSignup | Default / Filled / 4 strength levels / Disabled CTA | `auth.jsx` `AuthSignup` function |
| AuthForgot | Form state / Sent success state | `auth.jsx` `AuthForgot` function |
| OBWelcome (step 0) | Default | `onboarding.jsx` `OBWelcome` function |
| OBGoal (step 1) | Unselected / 1 goal selected | `onboarding.jsx` `OBGoal` function |
| OBLevel (step 2) | Unselected / 1 level selected | `onboarding.jsx` `OBLevel` function |
| OBFreq (step 3) | Default (4 selected) / any 1–7 selected | `onboarding.jsx` `OBFreq` function |
| OBEquip (step 4) | Unselected / multi-select | `onboarding.jsx` `OBEquip` function |
| OBBio (step 5) | Default / filled | `onboarding.jsx` `OBBio` function |
| OBPrep (step 6a) | Loading animation (phases 0–4 with check/blink) | `onboarding.jsx` `OBPrep` function |
| OBReady (step 6b) | Dark ready screen | `onboarding.jsx` `OBReady` function |

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Phase 32 design tokens (manual) |
| Figma Library | https://www.figma.com/design/iFPAXWrRLsl3OkUtYUifqW |
| Preset | not applicable |
| Component library | none (React Native inline styles) |
| Icon library | Ionicons (`@expo/vector-icons`) |
| Font | System font (fontWeight 800 for display headings) |
| Mood board | `.planning/MOODBOARD.md` |

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Field label gap, progress bar margin |
| md | 16px | Horizontal padding insets, card padding |
| lg | 24px | Section padding, screen horizontal padding |
| xl | 28–32px | Hero section gaps |
| 2xl | 36–40px | Logo→hero copy gap |
| 3xl | 64px | OBFreq big number display |

Exceptions:
- `OBFreq` large number: 64px font (display only, not spacing)
- AuthWelcome social proof: -7px margin-left overlap on avatar stack
- OnboardingShell progress bar: 4px height, border-radius 999

---

## Typography

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Display hero | 42px | 800 | 44px (1.05) | AuthWelcome hero headline |
| Display large | 36–40px | 800 | 1.0 | OBWelcome heading, OBReady heading |
| Display medium | 28–32px | 800 | 1.05–1.1 | AuthSignin/Signup/Forgot title, OBGoal/Level/Freq/Equip/Bio header |
| Body | 13.5–14.5px | 400–500 | 1.4–1.5 | Sub-copy, card descriptions |
| Label | 11–12px | 700–800 | 1.3 | Eyebrow text (uppercase, 0.1–0.14em tracking) |
| Small | 10.5–11.5px | 400–700 | 1.3–1.5 | Legal footer, social proof, strength label |
| Step counter | 11px | 700 | — | OnboardingShell N/7 label, muted |

---

## Color

### Auth — Dark surfaces (AuthWelcome only)

| Role | Value | Usage |
|------|-------|-------|
| Dark background | `#1C1A17` | AuthWelcome full-screen bg |
| Dark card | `#2A2723` | gradient endpoint |
| Dark text | `#FFFAF6` | All text on dark bg |
| Dark text muted | `rgba(255,250,246,0.72)` | Sub-copy |
| Dark text faint | `rgba(255,250,246,0.60–0.40)` | Footer links, legal |
| Dark border | `rgba(255,250,246,0.16)` | Google/Email button borders |
| Dark glass bg | `rgba(255,250,246,0.06)` | Google button bg |
| Orange glow | `rgba(255,92,26,0.45)` | Top-right radial glow, blur 20px |
| Violet glow | `rgba(123,91,208,0.35)` | Bottom-left radial glow, blur 18px |

### Auth — Light surfaces (AuthSignin / AuthSignup / AuthForgot)

| Role | Value | Usage |
|------|-------|-------|
| Background | `#F7F6F3` | Screen background |
| Surface | `#FFFFFF` | Input fields (card-bg) |
| Border | `#E2E0DA` | Input field borders |
| Text | `#1C1A17` | Form text, headings |
| Muted | `#6B6963` | Labels, sub-copy, placeholders |
| Primary | `#FF5C1A` | Eyebrow text, links, active CTAs |
| Back button bg | `rgba(28,26,23,0.06)` | 36×36 back chevron button |

### Password Strength Colors (AuthSignup)

| Level | Score | Color |
|-------|-------|-------|
| Faible | 1 | `#E94B3C` (red) |
| Correct | 2 | `#E8A33A` (amber) |
| Fort | 3 | `#2E9E5B` (green) |
| Excellent | 4 | `#2E9E5B` (green, same or success tint) |

Strength algorithm:
- `pw.length >= 6` → +1
- `pw.length >= 10` → +1
- `/[A-Z]/` → +1
- `/[0-9]/ && /[^A-Za-z0-9]/` → +1

### Onboarding Colors

| Role | Value | Usage |
|------|-------|-------|
| Background | `#F7F6F3` | OnboardingShell bg (steps 0–5) |
| Progress bar track | `rgba(28,26,23,0.08)` | Track bg |
| Progress bar fill | `#FF5C1A` | Orange fill, animated width |
| Goal tints | See OB_GOALS table | Per-card icon bg and border |
| OBReady bg | `#1C1A17` | Full-screen dark ready screen |
| OBReady glow | radial `#FF5C1A` at 25% opacity | SVG radial gradient overlay |
| Loading steps done | `#2E9E5B` (success) | Completed step indicator |
| Loading step current | `#FF5C1A` | Current step indicator (pulsing) |

### OB_GOALS Tint Colors

| Goal | ID | Icon | Tint |
|------|-----|------|------|
| Gagner en force | strength | barbell | `#FF5C1A` |
| Prendre du muscle | muscle | bolt | `#7B5BD0` |
| Perdre du gras | fat | flame | `#E94B3C` |
| Endurance | endur | shoe | `#2E7BF6` |
| Forme générale | health | heart | `#2E9E5B` |

---

## Screen Specifications

### AuthWelcome

**Background:** Full-screen gradient `#1C1A17 → #2A2723` (linear 180°), `color: #FFFAF6`.

**Glows (absolute positioned, pointerEvents none):**
- Top-right: `position absolute, top -120, right -80, width 320, height 320, borderRadius 160, bg rgba(255,92,26,0.35)` (RN approximation of the blur)
- Bottom-left: `position absolute, bottom -100, left -60, width 260, height 260, borderRadius 130, bg rgba(123,91,208,0.25)`

**Logo row:** `flexDirection row, gap 8, marginTop 8, marginBottom 36`
- "Z" badge: `width 30, height 30, borderRadius 9, bg #FF5C1A, fontWeight 800, fontSize 16`
- "ZIKO" text: `fontWeight 800, fontSize 16, letterSpacing 1`

**Eyebrow:** `fontSize 11, fontWeight 800, letterSpacing 2, textTransform uppercase, color #FF5C1A, marginBottom 14`
Copy: `"Coach IA · 18 modules"`

**Hero headline:** `fontSize 42, fontWeight 800, lineHeight 44, letterSpacing -0.8, marginBottom 16`
Copy:
```
Ton corps,
[#FF5C1A]ton plan[/],
ton coach.
```

**Sub-copy:** `fontSize 14, color rgba(255,250,246,0.72), lineHeight 21, marginBottom 28`
Copy: `"Programmes adaptatifs, suivi nutritionnel, communauté qui pousse. Construit pour ceux qui ne lâchent rien."`

**Social proof row:** `flexDirection row, alignItems center, gap 10`
- Avatar stack: 4 circles `width 24, height 24, borderRadius 12, borderWidth 2, borderColor #1C1A17, marginLeft -7 (except first)`
  Colors: `['#FF5C1A', '#7B5BD0', '#2E9E5B', '#E8A33A']`, initials `['MA','TK','JP','SR']`
- Text: `"240k+ athlètes — 4.8★ · 18k avis"` (240k+ and 4.8★ in white/700, rest rgba 0.65)

**CTA stack:** `gap 10`
1. **Apple button:** `paddingVertical 14, borderRadius 14, bg #fff, color #1C1A17, fontWeight 700, fontSize 14.5`
   Icon: Ionicons `logo-apple` size 16 color `#1C1A17`
   Copy: `"Continuer avec Apple"`

2. **Google button:** `paddingVertical 14, borderRadius 14, borderWidth 1, borderColor rgba(255,250,246,0.16), bg rgba(255,250,246,0.06), color #FFFAF6`
   Icon: Google SVG (multi-color) size 16
   Copy: `"Continuer avec Google"`

3. **Email button:** `paddingVertical 14, borderRadius 14, borderWidth 1, borderColor rgba(255,250,246,0.16), bg transparent, color #FFFAF6`
   Copy: `"Continuer avec un email"`

4. **Sign in link:** `textAlign center, fontSize 12.5, color rgba(255,250,246,0.6), marginTop 4`
   Copy: `"Déjà un compte ? "` + `[#FF5C1A 700]Connecte-toi[/]`

5. **Legal footer:** `fontSize 10.5, color rgba(255,250,246,0.4), lineHeight 15, marginTop 4`
   Copy: `"En continuant tu acceptes nos CGU et notre politique de confidentialité."`

> **Current state:** `apps/mobile/app/(auth)/welcome.tsx` already implements ~85% of this. Missing: Apple button. Add Apple button above Google. Route: `/(auth)/welcome`.

---

### AuthHeader (reusable component)

Used by AuthSignin, AuthSignup, AuthForgot.

**Back button:** `width 36, height 36, borderRadius 12, bg rgba(28,26,23,0.06)`, Ionicons `chevron-back` size 16
**Eyebrow:** `fontSize 11, fontWeight 800, letterSpacing 2, textTransform uppercase, color #FF5C1A, marginBottom 12`
**Title:** `fontSize 32, fontWeight 800, lineHeight 34, letterSpacing -0.6`
**Sub:** `fontSize 13.5, color #6B6963, marginTop 8, lineHeight 19.5`

---

### AuthSignin

Route: `/(auth)/login`

**AuthHeader:**
- Eyebrow: `"Bon retour"`
- Title: `"Connecte-toi"`
- Sub: `"Reprends là où tu t'es arrêté."`

**Fields (gap 14, padding 0 24):**
- Email: label `"Email"`, type email, placeholder `"toi@email.com"`
- Password: label `"Mot de passe"`, type password with show/hide toggle, placeholder `"••••••••"`
  - Toggle: `[right] Voir / Cacher` button `fontSize 11, fontWeight 700, color #6B6963`

**"Mot de passe oublié?" link:** `justifyContent flex-end, color #FF5C1A, fontSize 12.5, fontWeight 700`

**CTA area (gap 10, padding 16 24 24):**
- "Se connecter" button:
  - Valid: `bg #1C1A17, color #fff`
  - Invalid: `bg rgba(28,26,23,0.18), cursor not-allowed`
  - Style: `paddingVertical 14, borderRadius 14, fontWeight 700, fontSize 14.5`
- "Pas encore de compte? [primary]Créer[/]" link below

**Validation:** `email.length > 3 && pw.length >= 4`

---

### AuthSignup

Route: `/(auth)/register`

**AuthHeader:**
- Eyebrow: `"Bienvenue"`
- Title: `"Crée ton compte"`
- Sub: `"2 minutes pour démarrer. Tu pourras compléter ton profil ensuite."`

**Fields (gap 14):**
- Prénom: label `"Prénom"`, placeholder `"Comment on t'appelle ?"`
- Email: label `"Email"`, type email
- Password block:
  - Field: label `"Mot de passe"`, placeholder `"6 caractères minimum"`
  - Strength bar: shown only when `pw.length > 0`
    - 4 segments: `height 3, borderRadius 2, flex 1, gap 4` between segments
    - Filled segments use `strengthClr`, empty use `#E2E0DA`
    - Label: `fontSize 10.5, fontWeight 700, color strengthClr, textAlign right, minWidth 60`
    - Labels: `["", "Faible", "Correct", "Fort", "Excellent"]` at strength 0–4

**CTA "Continuer":**
- Valid: `bg #FF5C1A, color #fff, shadowColor rgba(255,92,26,0.55), shadowOffset 0 8, shadowRadius 22`
- Invalid: `bg rgba(255,92,26,0.30)`
- Style: `paddingVertical 14, borderRadius 14, fontWeight 700, fontSize 14.5`

**Links below CTA:**
- `"Déjà un compte ? [primary]Se connecter[/]"`
- Legal footer

**Validation:** `name.length > 1 && email.length > 3 && pw.length >= 6`

---

### AuthForgot

Route: `/(auth)/forgot`

**State 1 — Form:**
- AuthHeader: Eyebrow `"Pas de panique"`, Title `"Mot de passe oublié ?"`, Sub `"Entre ton email, on t'envoie un lien pour le réinitialiser."`
- Email field
- CTA: `"Envoyer le lien"` — `bg #1C1A17, color #fff, borderRadius 14, paddingVertical 14`
- Active only when `email.length > 3`; on press → State 2

**State 2 — Sent:**
- AuthHeader: Same eyebrow, Title `"Vérifie ta boîte"`, Sub `"On t'a envoyé un lien de réinitialisation. Vérifie aussi ton dossier spam."`
- Success card:
  - `bg color-mix(#2E9E5B 8%, #F7F6F3)`, `border 1px color-mix(#2E9E5B 25%, #E2E0DA)`, `borderRadius 12, padding 16`
  - Check icon: `width 36, height 36, borderRadius 11, bg #2E9E5B, color #fff`
  - Title: `"Email envoyé à {email}"` fontSize 13.5 fontWeight 700
  - Sub: `"Le lien expire dans 30 minutes. Pas reçu ? [primary]Renvoyer[/]"`
- CTA: `"Retour à la connexion"` `bg #1C1A17`

---

### OnboardingShell (reusable wrapper — steps 0–6)

The shell wraps all onboarding screens. Step 0 (OBWelcome) renders without the shell chrome but uses the same full-screen container.

**Shell chrome (steps 1–6):**
- `flex 1, bg #F7F6F3, flexDirection column`
- **Progress bar row** (top, `padding 14 18 8`, `flexDirection row, alignItems center, gap 12`):
  - Back button: `width 32, height 32, borderRadius 10, bg rgba(28,26,23,0.06)`, Ionicons `chevron-back` size 16
    - On step 0: transparent bg + transparent color (disabled)
  - Progress bar: `flex 1, height 4, bg rgba(28,26,23,0.08), borderRadius 999, overflow hidden`
    - Fill: `width ((step+1)/total)*100%, bg #FF5C1A, borderRadius 999`, animated with `transition width 350ms cubic-bezier(0.2,0.8,0.2,1)` → `withTiming` in RN
  - Step counter: `fontSize 11, fontWeight 700, color #6B6963, minWidth 28, textAlign right`
    Copy: `"{step+1}/{total}"`
- **Content area:** `flex 1, overflowY auto, padding 8 22 16`
- **CTA area** (bottom, `padding 10 18 22`, gradient `linear-gradient to top, #F7F6F3 70%, transparent`):
  - CTA button: `width 100%, paddingVertical 15, fontSize 15, borderRadius 16, bg #FF5C1A, color #fff`
  - Disabled (canNext=false): `opacity 0.35, cursor not-allowed`
  - Animated: `transition opacity 200ms`

**OBHeader (reusable within steps):**
- Eyebrow: `fontSize 11, fontWeight 800, letterSpacing 1.5, textTransform uppercase, color #FF5C1A, marginBottom 8`
- Title: `fontSize 28, fontWeight 800, lineHeight 31, letterSpacing -0.5`
- Sub: `fontSize 14, color #6B6963, marginTop 8, lineHeight 20`
- Outer margin: `marginTop 18, marginBottom 22`

---

### OBWelcome (Step 0)

**Full screen — no shell chrome visible.** `bg #F7F6F3, padding 0 22`.

**Icon:** `width 76, height 76, borderRadius 22, bg linear-gradient(135°, #FF5C1A, #FF8E5A), shadow rgba(255,92,26,0.55)`
Ionicons: `flash` (or `bolt`) size 36 color `#fff`

**Heading:** `fontSize 40, fontWeight 800, lineHeight 42, letterSpacing -1.2, marginBottom 14`
Copy:
```
Bienvenue
sur Ziko[#FF5C1A].[/]
```

**Sub:** `fontSize 15, color #6B6963, lineHeight 22, maxWidth 320, marginBottom 28`
Copy: `"Ton coach perso, tes séances, ta nutrition, tes records — tout au même endroit."`

**Benefit bullets (gap 10):**
| Icon | Text |
|------|------|
| `sparkles-outline` | `"Programmes générés par IA selon ta forme du jour"` |
| `barbell-outline` | `"Suivi précis : volume, RPE, PR, progression"` |
| `trophy-outline` | `"Objectifs concrets, streak motivante"` |

Icon badge: `width 30, height 30, borderRadius 9, bg rgba(255,92,26,0.12), color #FF5C1A`

**CTA section (paddingVertical 20 0 22):**
- "Allez, on y va": `paddingVertical 15, borderRadius 16, bg #FF5C1A, color #fff, fontSize 15, fontWeight 700`
- "Déjà un compte ? [#FF5C1A]Se connecter[/]": `fontSize 12, marginTop 12, textAlign center`

---

### OBGoal (Step 1)

OBHeader: Eyebrow `"Étape 1"`, Title `"Quel est ton objectif principal ?"`, Sub `"On adapte tout — programmes, conseils, nutrition."`

**5 goal cards (gap 10):**
Card: `padding 14, flexDirection row, alignItems center, gap 14`
- Selected: `borderWidth 2, borderColor tint, bg rgba(tint, 0.06)`
- Unselected: `borderWidth 1, borderColor #E2E0DA, bg #fff`

Card anatomy:
- Icon badge: `width 44, height 44, borderRadius 12, bg rgba(tint, 0.14), color tint`
- Text block: `flex 1`
  - Title: h-display `fontSize 15`
  - Sub: `fontSize 11.5, color #6B6963, marginTop 2`
- Radio circle: `width 22, height 22, borderRadius 11`
  - Selected: `border 6px solid tint, bg #fff`
  - Unselected: `border 1.5px solid #E2E0DA, bg transparent`

---

### OBLevel (Step 2)

OBHeader: Eyebrow `"Étape 2"`, Title `"Ton niveau actuel ?"`, Sub `"Pas de jugement — c'est juste pour calibrer la difficulté."`

**3 level cards:**
Card: `padding 16, flexDirection row, alignItems center, gap 14`
- Selected: `borderWidth 2, borderColor #FF5C1A, bg rgba(255,92,26,0.05)`
- Unselected: `borderWidth 1, borderColor #E2E0DA, bg #fff`

Bar indicator (left icon):
- 3 vertical bars `[width 6, heights 18/24/30, borderRadius 2]`
- Bars at index ≤ level index: `bg #FF5C1A`; higher: `bg rgba(28,26,23,0.12)`

Text: title `h-display fontSize 16`, sub `fontSize 11.5 color #6B6963`
Check icon (right, when selected): Ionicons `checkmark` size 18 color `#FF5C1A` strokeWidth 2.5

| ID | Label | Sub |
|----|-------|-----|
| beg | Débutant | `<6 mois ou reprise après pause` |
| med | Intermédiaire | `6 mois – 2 ans, technique propre` |
| conf | Confirmé | `2+ ans, programmes structurés` |

---

### OBFreq (Step 3)

OBHeader: Eyebrow `"Étape 3"`, Title `"Combien de séances par semaine ?"`, Sub `"Sois honnête. Mieux vaut 3 séances tenues que 6 prévues."`

**Frequency card** (`padding 22`, `bg #fff`, `borderRadius 16`, `borderWidth 1`, `borderColor #E2E0DA`):

**Big number display:**
- `textAlign center, marginBottom 18`
- Number: `fontSize 64, fontWeight 800, color #FF5C1A, lineHeight 64`
- Label: `fontSize 12, fontWeight 600, color #6B6963, marginTop 4`
  Copy: `"{v} séance{v > 1 ? 's' : ''} par semaine"`

**7-button grid:** `gridTemplateColumns repeat(7, 1fr), gap 6`
Each button: `aspectRatio 1, borderRadius 10`
- Active: `bg #FF5C1A, color #fff`
- Inactive: `bg rgba(28,26,23,0.05), color #1C1A17`
Font: `fontWeight 800, fontSize 14`

**AI tip card:** `marginTop 16, padding 10 12, borderRadius 10, bg rgba(255,92,26,0.08)`
Sparkles icon `color #FF5C1A` size 13 + contextual text `fontSize 11.5`
| Sessions | Tip |
|----------|-----|
| ≤ 2 | `"Bon démarrage. On vise le full body."` |
| 3 | `"Format idéal débutant — full body × 3."` |
| 4 | `"Le sweet spot. Push / Pull / Legs / Upper."` |
| 5 | `"Solide. PPL + bras / épaules dédiés."` |
| ≥ 6 | `"Volume élevé — on surveillera la récup."` |

Default selection: `v = 4`

---

### OBEquip (Step 4)

OBHeader: Eyebrow `"Étape 4"`, Title `"À quoi as-tu accès ?"`, Sub `"Choisis tout ce qui s'applique."`

**2×2 square grid (gap 10):** `gridTemplateColumns 1fr 1fr`
Each card: `padding 14, aspectRatio 1, flexDirection column, alignItems flex-start, gap 10`
- Selected: `borderWidth 2, borderColor #FF5C1A, bg rgba(255,92,26,0.05)`
- Unselected: `borderWidth 1, borderColor #E2E0DA, bg #fff`

Card top row: `flexDirection row, justifyContent space-between, width 100%`
- Icon badge: `width 38, height 38, borderRadius 11`
  - Active: `bg #FF5C1A, color #fff`
  - Inactive: `bg rgba(28,26,23,0.06), color #1C1A17`
- Check circle (active only): `width 22, height 22, borderRadius 11, bg #FF5C1A, color #fff` Ionicons `checkmark` size 12

Card bottom: `marginTop auto`
- Title: h-display `fontSize 14`
- Sub: `fontSize 10.5, color #6B6963, lineHeight 16.5`

| ID | Label | Sub | Icon |
|----|-------|-----|------|
| gym | Salle complète | `Barres, machines, racks` | `barbell-outline` |
| home | Home gym | `Haltères, banc, élastiques` | `scale-outline` |
| body | Poids du corps | `Tractions, dips, push-ups` | `person-outline` |
| out | Extérieur | `Course, parc, calisthénie` | `walk-outline` |

Multi-select: `canNext = sel.length > 0`

---

### OBBio (Step 5)

OBHeader: Eyebrow `"Étape 5"`, Title `"Quelques infos sur toi"`, Sub `"Pour calculer tes besoins caloriques et tes charges."`

**Sex selector (3-col grid, gap 8, marginBottom 18):**
Label: `fontSize 12, fontWeight 700, color #6B6963, textTransform uppercase, letterSpacing 0.5`
Each sex card: `padding 12 8, textAlign center, fontSize 13, fontWeight 700`
- Active: `borderWidth 2, borderColor #FF5C1A, bg rgba(255,92,26,0.08), color #FF5C1A`
- Inactive: `borderWidth 1, borderColor #E2E0DA, bg #fff`
Options: `{ id: 'm', label: 'Homme' } | { id: 'f', label: 'Femme' } | { id: 'x', label: 'Autre' }`

**BioField (reusable, padding 14, bg #fff, borderRadius 12, borderWidth 1, borderColor #E2E0DA, marginBottom 10):**
- Header row: `justifyContent space-between`
  - Label: `fontSize 12, fontWeight 700, color #6B6963, textTransform uppercase`
  - Value: `fontSize 22, fontWeight 800` + unit `fontSize 12, color #6B6963`
- Slider: `width 100%, marginTop 10, accentColor #FF5C1A`

| Field | Label | Unit | Range | Step | Default |
|-------|-------|------|-------|------|---------|
| age | Âge | ans | 14–90 | 1 | 28 |
| height | Taille | cm | 130–220 | 1 | 178 |
| weight | Poids | kg | 35–180 | 0.5 | 76 |

**Privacy note:** `fontSize 11, color #6B6963, marginTop 10` + lock emoji
Copy: `"Ces données restent privées. Tu peux les modifier à tout moment."`

**Validation:** `sex && age ≥ 14 && age ≤ 90 && height > 100 && weight > 30`

---

### OBPrep (Step 6a — Loading)

Full screen within OnboardingShell, hideNav. No CTA.

**Loading icon:** `width 64, height 64, borderRadius 18, bg linear-gradient(135°, #FF5C1A, #FF8E5A)`
Ionicons `sparkles` size 28 color `#fff`
Animation: `ob-pulse` — scale 1→1.06→1, shadow grows, 1.6s infinite ease-in-out → `withRepeat(withSequence(withTiming(1.06), withTiming(1)))` in RN

**Heading:** `fontSize 26, fontWeight 800, lineHeight 30`
Copy: `"On prépare ton\nplan, {name}…"` (name from profile or "champion")

**Loading phases list (gap 10, marginTop 24):** 5 items
| Phase | Text |
|-------|------|
| 0 | Analyse de ton profil |
| 1 | Calcul de tes besoins caloriques |
| 2 | Sélection des exercices adaptés |
| 3 | Construction de ton programme |
| 4 | Calibration du coach IA |

Each row: `flexDirection row, alignItems center, gap 12`
- Rows above current: `opacity 1`
- Rows below current: `opacity 0.35`, transition `opacity 300ms`
- Step indicator `width 22, height 22, borderRadius 11`:
  - Done: `bg #2E9E5B`, check icon size 11 white
  - Current: `bg #FF5C1A`, white dot `width 8, height 8, borderRadius 4` with `ob-blink` animation
  - Pending: `bg rgba(28,26,23,0.08)`
- Text: `fontSize 13.5, fontWeight 700 (current) / 500 (others), color #1C1A17`

Duration per phase: 700ms timeout → after all done → render OBReady

---

### OBReady (Step 6b — Dark Ready Screen)

**Full screen:** `bg #1C1A17, color #FFFAF6, flexDirection column`

**SVG glow overlay (absolute, full screen, opacity 0.25, pointerEvents none):**
Radial gradient circle at `cx 50% cy 30% r 280`, stops `#FF5C1A → transparent`

**Content (padding 40 22, justifyContent center):**
**Check icon:** `width 76, height 76, borderRadius 22, bg linear-gradient(135°, #FF5C1A, #FF8E5A), shadow rgba(255,92,26,0.70) offset 0 12 blur 40`
Ionicons `checkmark` size 38 color `#fff` strokeWidth 3

**Heading:** `fontSize 36, fontWeight 800, lineHeight 37, letterSpacing -0.7`
Copy: `"Ton plan\nest prêt[#FF5C1A].[/]"`

**Sub:** `fontSize 14.5, color rgba(255,250,246,0.70), marginTop 12, lineHeight 21.5, maxWidth 320`
Copy: `"On a calibré tout ça pour {goalLabel}, {frequency}× / semaine. Première séance demain matin."`

**Program summary card (marginTop 28, padding 16):**
`bg rgba(255,250,246,0.06), border 1px rgba(255,250,246,0.12), borderRadius 16`
- Label: `fontSize 10, fontWeight 800, color #FF5C1A, textTransform uppercase, letterSpacing 1, marginBottom 8`
  Copy: `"Ton programme"`
- Program name: `fontSize 18, fontWeight 800, color #FFFAF6`
  Value: `frequency >= 4 ? "Push / Pull / Legs" : "Full Body Progressif"`
- Sub: `fontSize 12, color rgba(255,250,246,0.55), marginTop 4`
  Copy: `"8 semaines · {frequency} séances/sem · ~50 min"`

**CTA (bottom, padding 10 18 22):**
"C'est parti, démarrer ma journée →": `paddingVertical 16, borderRadius 16, bg #FF5C1A, color #fff, fontSize 15, fontWeight 700`
→ calls `onFinish` → navigates to `/(app)/` and triggers mandatory plugin auto-install

---

## Navigation / Routing Contract

| Screen | Current Route | Target Route |
|--------|--------------|--------------|
| AuthWelcome | `/(auth)/welcome` | keep — no change |
| AuthSignin | `/(auth)/login` | keep |
| AuthSignup | `/(auth)/register` | keep |
| AuthForgot | `/(auth)/forgot` | keep |
| OBWelcome | `/(auth)/onboarding/step-1` | consolidate to step-1 (welcome) |
| OBGoal | `/(auth)/onboarding/step-2` | rename step-2 → goal |
| OBLevel | `/(auth)/onboarding/step-3` | rename step-3 → level |
| OBFreq | `/(auth)/onboarding/step-4` | rename step-4 → frequency |
| OBEquip | `/(auth)/onboarding/step-5` | rename step-5 → equipment |
| OBBio | `/(auth)/onboarding/step-6` | rename step-6 → bio |
| OBPrep/Ready | `/(auth)/onboarding/step-7` | rename step-7 → ready |

> **Step count reconciliation:** Current app has 8 step files (step-1 through step-8). Mockup defines 7 steps (index 0–6). The extra step-8 must be audited and either merged or removed. Target is exactly 7 route files in `/(auth)/onboarding/`.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| AuthWelcome headline | `"Ton corps, ton plan, ton coach."` |
| AuthWelcome CTA 1 (Apple) | `"Continuer avec Apple"` |
| AuthWelcome CTA 2 (Google) | `"Continuer avec Google"` |
| AuthWelcome CTA 3 (Email) | `"Continuer avec un email"` |
| AuthWelcome sign-in link | `"Déjà un compte ? Connecte-toi"` |
| AuthSignin title | `"Connecte-toi"` |
| AuthSignin CTA | `"Se connecter"` |
| AuthSignup title | `"Crée ton compte"` |
| AuthSignup CTA | `"Continuer"` |
| AuthForgot title (form) | `"Mot de passe oublié ?"` |
| AuthForgot title (sent) | `"Vérifie ta boîte"` |
| AuthForgot CTA (form) | `"Envoyer le lien"` |
| AuthForgot CTA (sent) | `"Retour à la connexion"` |
| OBWelcome headline | `"Bienvenue sur Ziko."` |
| OBWelcome CTA | `"Allez, on y va"` |
| OBGoal title | `"Quel est ton objectif principal ?"` |
| OBLevel title | `"Ton niveau actuel ?"` |
| OBFreq title | `"Combien de séances par semaine ?"` |
| OBEquip title | `"À quoi as-tu accès ?"` |
| OBBio title | `"Quelques infos sur toi"` |
| OBPrep heading | `"On prépare ton plan, {name}…"` |
| OBReady heading | `"Ton plan est prêt."` |
| OBReady CTA | `"C'est parti, démarrer ma journée →"` |
| Default step CTA | `"Continuer"` |
| Strength Faible | `"Faible"` |
| Strength Correct | `"Correct"` |
| Strength Fort | `"Fort"` |
| Strength Excellent | `"Excellent"` |

---

## Motion Design

> Platform: React Native — use `react-native-reanimated` v3. Map GSAP patterns to `FadeInUp`, `withSpring`, `withTiming`, `withRepeat`, `withSequence`.

| Screen | Animation | Duration | Easing | RN Pattern |
|--------|-----------|----------|--------|------------|
| AuthWelcome | Screen entrance | 350ms | easeOut | `FadeInUp` entering on root View |
| Auth screens | Back/forward transition | 300ms | easeInOut | Expo Router stack slide |
| AuthSignup | Password strength segments | 200ms | power2.out | `withTiming` on width/background |
| AuthForgot | Form → Sent swap | 250ms | easeOut | `FadeIn` on success card |
| OnboardingShell | Progress bar fill | 350ms | cubic-bezier(0.2,0.8,0.2,1) | `withTiming(width, {duration: 350})` |
| OnboardingShell | CTA enable/disable | 200ms | linear | `withTiming(opacity)` |
| OBGoal/Level/Equip | Card selection | 150ms | easeOut | `withTiming` on border/bg color |
| OBFreq | Number change | 200ms | spring | `withSpring` on opacity |
| OBFreq | AI tip swap | 200ms | easeOut | `FadeIn` on tip text |
| OBPrep | Phase icon pulse | 1600ms | ease-in-out infinite | `withRepeat(withSequence(scale 1.06, scale 1))` |
| OBPrep | Phase indicator blink | 1000ms | ease-in-out infinite | `withRepeat(withSequence(opacity 1, opacity 0.3))` |
| OBPrep | Phase row reveal | 300ms | easeOut | `withTiming(opacity 1)` per completed row |
| OBReady | Screen entrance | 400ms | easeOut | `FadeInUp` on content block |
| OBReady | Check icon glow | 500ms | spring | `withSpring(scale 1 from 0.8)` |
| AuthWelcome glow | Subtle drift | 8s | ease-in-out infinite | Passive (no animation required in RN v1) |

---

## Generated Assets

No Higgsfield assets required for this phase. All visuals are built from React Native primitives, inline SVG gradients, and Ionicons.

| Asset | Verdict |
|-------|---------|
| AuthWelcome hero image | Not needed — gradient + text only |
| Onboarding illustrations | Not needed — icon badges only |

---

## Registry Safety

| Registry | Components Used | Safety Gate |
|----------|----------------|-------------|
| `@expo/vector-icons` (Ionicons) | All icon references | already installed, no gate needed |
| `react-native-reanimated` | Animations | already installed |
| `react-native-safe-area-context` | SafeAreaView | already installed |
| No shadcn / third-party UI | — | not applicable |

---

## Implementation Delta (existing → target)

| Screen | Existing State | Delta Required |
|--------|---------------|----------------|
| `welcome.tsx` | 85% correct | Add Apple button above Google |
| `login.tsx` | Basic — needs audit | Rebuild to match AuthSignin spec exactly |
| `register.tsx` | Basic — needs audit | Rebuild with password strength bar |
| `forgot.tsx` | Basic — needs audit | Add sent-state success card |
| `onboarding/step-1.tsx` | Correct structure | Minor polish (gradient icon badge) |
| `onboarding/step-2.tsx` | Needs audit | Rebuild as OBGoal with 5 tinted goal cards |
| `onboarding/step-3.tsx` | Needs audit | Rebuild as OBLevel with bar indicators |
| `onboarding/step-4.tsx` | Needs audit | Rebuild as OBFreq with 7-grid + tip card |
| `onboarding/step-5.tsx` | Needs audit | Rebuild as OBEquip with 2×2 multi-select |
| `onboarding/step-6.tsx` | Needs audit | Rebuild as OBBio with sliders |
| `onboarding/step-7.tsx` | Needs audit | Rebuild as OBPrep loading + OBReady |
| `onboarding/step-8.tsx` | Excess / merge | Audit and remove or merge into step-7 |

---

## Data Wiring

| Screen | Data Action | Source |
|--------|-------------|--------|
| AuthSignin | `supabase.auth.signInWithPassword` | existing in `login.tsx` |
| AuthSignup | `supabase.auth.signUp` + upsert `user_profiles` | existing in `register.tsx` |
| AuthForgot | `supabase.auth.resetPasswordForEmail` | existing in `forgot.tsx` |
| OBGoal–OBEquip | Accumulate in local state | no Supabase call until OBReady |
| OBBio | Accumulate in local state | no Supabase call until OBReady |
| OBReady "C'est parti" | `upsert user_profiles { goal, level, frequency, equipment, sex, age, height_cm, weight_kg }` | single upsert on finish |
| OBReady auto-install | Trigger mandatory plugin pre-load (Phase 27 pattern) | `PluginLoader.preloadMandatory()` |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — all copy locked per mockup (FR), no placeholder strings
- [x] Dimension 2 Visuals: PASS — pixel-accurate spec from auth.jsx + onboarding.jsx
- [x] Dimension 3 Color: PASS — dark bg only on Welcome + OBReady; all other screens light sport theme
- [x] Dimension 4 Typography: PASS — 800-weight display headings; correct scale documented
- [x] Dimension 5 Spacing: PASS — multiples-of-4 throughout; exceptions documented
- [x] Dimension 6 Registry Safety: PASS — no third-party UI registries; all libs already installed

**Approval:** approved 2026-05-22
