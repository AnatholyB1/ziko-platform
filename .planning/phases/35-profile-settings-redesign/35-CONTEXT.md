---
phase: 35-profile-settings-redesign
type: gap-closure-context
created: 2026-05-22
status: locked
---

# Phase 35 — Gap Closure Context

Decisions locked after smoke test failures and user discussion.
Downstream planner and executor agents: act on these decisions without re-asking.

---

## Root Cause Diagnosis

| Bug reported | Root cause |
|---|---|
| `settings column not found` | Migrations non appliquées en production — `settings JSONB` existe dans migration 001 mais schema cache Supabase remote désynchronisé |
| Upload photo progrès — network failed | Buckets `avatars` + `profile-photos` existent dans migrations 017 + 025 mais potentiellement non créés en prod |
| Photo de profil pas affichée | Code bug probable : query SELECT ne retourne peut-être pas `avatar_url`, ou Image component pas rendu si avatarUrl = null |
| Alerte sur "Informations personnelles" | Navigation vers une route inexistante dans settings.tsx — doit pointer vers `/(app)/profile/edit` (fichier existe déjà) |
| `bio`, `handle` non sauvegardés | Colonnes ABSENTES de `user_profiles` — n'existent nulle part (`bio` est dans `coach_profiles`, `handle` inexistant) |
| `subscription_tier` hardcodé | Colonne inexistante dans `user_profiles` |
| `is_public` / confidentialité | Colonne inexistante dans `user_profiles` |
| Badges hardcodés | Aucune table user_badges / badge_definitions — STATIC_BADGES sont des fixtures locales |

---

## Decision 1 — Colonnes profil manquantes

**Décision : Colonnes dédiées (pas JSONB)**

Migration 051 ajoute à `user_profiles` :
```sql
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'coach'))
```

Conséquence sur le code :
- `edit.tsx` : sauvegarder `bio` et `handle` comme colonnes directes (pas dans settings JSONB)
- `settings.tsx` : lire `profile.subscription_tier` directement (pas settings JSONB)
- `security.tsx` : lire/écrire `is_public` comme colonne directe

---

## Decision 2 — Système de badges

**Décision : Badges d'accomplissement (earned by actions)**

Deux nouvelles tables dans migration 051 :

```sql
CREATE TABLE public.badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,  -- emoji
  condition_type TEXT NOT NULL CHECK (condition_type IN ('sessions', 'streak', 'prs', 'profile_complete', 'friends')),
  condition_value INTEGER NOT NULL,
  tier INTEGER DEFAULT 1  -- 1=bronze, 2=argent, 3=or
);

CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_slug TEXT REFERENCES badge_definitions(slug),
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_slug)
);
```

Badge definitions à seed :
- `first_session` — 1ère séance (sessions >= 1)
- `ten_sessions` — 10 séances (sessions >= 10)
- `fifty_sessions` — 50 séances (sessions >= 50)
- `hundred_sessions` — 100 séances (sessions >= 100)
- `streak_7` — Streak 7 jours (habit_logs consécutifs >= 7)
- `streak_30` — Streak 30 jours (>= 30)
- `streak_100` — Streak 100 jours (>= 100)
- `first_pr` — 1er PR (session_sets.is_pr >= 1)
- `ten_prs` — 10 PRs (session_sets.is_pr >= 10)
- `profile_complete` — Profil complet (avatar_url + bio + goal non null)
- `first_friend` — 1er ami (friendships >= 1)

Attribution : RPC `check_and_award_badges(p_user_id)` appelée côté mobile après chaque action pertinente (fin de séance, mise à jour profil, ajout ami).

Affichage dans `PRBadgesTab` : query `user_badges` join `badge_definitions`, badges gagnés affichés colorés, non-gagnés en gris opacité 0.4.

---

## Decision 3 — Migration

**Décision : Migration unique 051_profile_settings_gap.sql**

Contenu de migration 051 :
1. ADD COLUMN bio, handle, is_public, subscription_tier sur user_profiles
2. CREATE TABLE badge_definitions + seed des 11 badges
3. CREATE TABLE user_badges + RLS
4. CREATE OR REPLACE FUNCTION check_and_award_badges(p_user_id UUID)
5. Vérifier/créer buckets storage si absents (INSERT ... ON CONFLICT DO NOTHING)

---

## Decision 4 — "Informations personnelles" navigation

**Décision : Pointer vers edit.tsx existant**

Dans `settings.tsx`, la STRow "Informations personnelles" doit naviguer vers `/(app)/profile/edit` (pas une nouvelle route). C'est un bug de navigation — le fichier `edit.tsx` existe déjà.

---

## Decision 5 — Scope hardcodé (priorité)

**Décision : Audit complet + fix critique d'abord**

Ordre de priorité :
1. Bugs bloquants (migration, navigation, avatar display) — plan 35-12 + 35-13
2. Badges système — plan 35-14
3. Audit exhaustif + wiring des pages critiques — plan 35-15
4. Pages non critiques (parrainage, aide) restent en stub propre commenté

---

## Canonical Refs pour downstream agents

- `supabase/migrations/001_initial_schema.sql` — colonnes existantes user_profiles (avatar_url, settings JSONB, goal, etc.)
- `supabase/migrations/007_gamification_schema.sql` — shop_items/user_inventory (badges boutique — distinct des badges accomplissement)
- `supabase/migrations/017_avatars_storage.sql` — bucket avatars
- `supabase/migrations/025_storage_buckets.sql` — bucket profile-photos
- `apps/mobile/app/(app)/profile/edit.tsx` — écran édition profil déjà créé
- `apps/mobile/app/(app)/profile/settings.tsx` — écran settings à corriger
- `apps/mobile/app/(app)/profile/index.tsx` — PRBadgesTab à connecter aux vraies données

---

## Deferred (hors scope gap closure 35)

- Stripe billing / abonnements → prochain milestone
- Parrainage avec vraie table referrals → phase future
- Centre d'aide CMS (Notion/Intercom) → phase contenu future
