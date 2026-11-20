# Phase 1 - Plan 01 : SUMMARY

Branche `phase/01-quetes` (depuis `milestone/v1.21`, fusionnée avant le gate). Aucune base touchée, aucun push.

## Livré
- Migration (fichier seul) `supabase/portfolio-migrations/20261215010100_welcome_quests_meal_template.sql` : template starter `starter_daily_meal` (nutrition_logs, 15 pièces), ordre eau/repas/séance, libellés de bienvenue, `starter_weekly_train` est CONSERVÉ (D-11 : l'accueil plafonne à 3 en préférant les quotidiennes). Aucune fonction modifiée : `ziko_sync_quests` (20261201290400) crée déjà un starter par modèle `is_starter AND is_active` avec `ON CONFLICT (user_id, slug, period_start) DO NOTHING`.
- Mobile : `src/lib/homeQuests.ts` (pur), `src/hooks/useHomeQuests.ts` (lecture = RPC, erreur remontée), `src/components/home/QuestsBlock.tsx`, une insertion (+4 lignes) dans `app/(app)/index.tsx` sous Mission du jour. Stub de test `react-native.tsx` étendu (Animated, AccessibilityInfo, aria-label/role).
- Backend CLAR-03 : prompt + `coerceFirstMission` (niveau 1 -> `hydration_log`, titre réécrit fr/en) ; la route passe la locale à `assess_profile`.
- CLAR-04 : table métrique->route validée par `isPluginRouteLocked` ; aucun changement de `_layout.tsx` / `gating.ts` nécessaire (preuve par test).

## Exigence -> statut
Voir `01-01-PLAN.md` (table exigence -> test). Tout est couvert par tests automatiques ; rien n'est prouvé sur appareil (phase 3).

## Écarts au contrat
- Pièces masquées sous le niveau 3 (D-05) : la maquette les montre, CONTEXT l'emporte (puces, « +15 », texte « Terminé » sans pièces, toast sans pièces, « +55 pièces gagnées » absent).
- Toast : bandeau vert dans le bloc (3 s), pas de toast en haut d'écran ; pas de translation d'entrée du toast.
- Animations : cascade 40 ms / fondu / décalage 8 dp implémentés ; pas de balayage du squelette, pas d'animation de bascule de couleur de ligne, pas de montée de la pastille « +15 » (apparition fixe). Reduced motion : pas de cascade.
- Carte « tout fait » : le message et « +N pièces gagnées » (niveau >= 3) sont dans un seul texte.
- Libellé et texte d'action des quêtes de départ portés aussi côté app (slug) pour les instances déjà créées.
- Ajout d'une action `habit_logs -> /(plugins)/habits/dashboard` (quêtes IA) ; métrique inconnue = quête masquée.
- Haptique : `expo-haptics` déjà dépendance du mobile, utilisé tel quel.

## À faire par un humain
- Appliquer la migration `20261215010100` (d'abord sur `uat-v1-20`). Décision prise (D-11) : la quête hebdo « S'entraîner 3 fois » est gardée ; la migration ne la modifie pas.
- Comptes existants : ils recevront aussi la quête « Ajoute un repas » à la prochaine synchro.

## Non prouvé
Rendu réel (polices, ombre, densité, dynamic type 130 %), haptique, annonce TalkBack, navigation Expo Router réelle (le garde est testé sur les segments, pas monté), SQL réel de la migration (aucune base), cibles tactiles ≥ 44 dp mesurées (A9), A12, UAT Maestro A4/A8/A16. Course connue de test préexistant : `rewards.test.tsx` peut lever une erreur « window is not defined » (minuteur de toast après démontage) sous charge ; observée une fois sur 4 exécutions complètes, absente sans mon test et à chaque nouvelle exécution.

## Gate
`npm run type-check` OK, `npm run lint` OK (mobile : pas de config), `npx turbo run test` OK (mobile 43+13 fichiers ; api 51 fichiers), `npm run build` (backend/api) OK.
