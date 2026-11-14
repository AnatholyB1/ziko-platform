# Phase 21 : Social et Amis, SUMMARY

Branche `phase/21-social` (base `milestone/v1.20`, merge de `milestone/v1.20` fait ; gate verte). Aucun push, aucune écriture en base, migrations en fichiers seulement.

## Livré
- **Migrations** (`supabase/migrations/`, non appliquées) :
  - `20261201210100_friendships_integrity.sql` : dédoublonnage des paires croisées (garde l'acceptée, sinon pending, sinon la plus ancienne), index unique sur la paire non ordonnée, INSERT limité à `status='pending'`, UPDATE réservé au destinataire (`pending -> accepted`), trigger d'immutabilité de `requester_id`/`addressee_id`/`created_at`. Requête de comptage lecture seule en tête du fichier (Q-P21b).
  - `20261201210200_friend_rpc.sql` : `ziko_send_friend_request` (atomique : soi-même refusé, no-op si déjà envoyée, **accepte** si demande inverse, verrou consultatif par paire), `ziko_search_users_with_status` (relation calculée avec `auth.uid()`, accents/jokers LIKE, 2 caractères min, nom ou pseudo), `ziko_list_friendships` (amis/reçues/envoyées avec nom, pseudo, niveau : nécessaire car `ziko_user_profiles` n'est lisible que par son propriétaire). SECURITY DEFINER, `search_path` figé, `REVOKE ... PUBLIC, anon`, `GRANT ... authenticated`. L'ancien `ziko_search_users_fuzzy` est laissé en place.
  - `20261201210300_public_profile_rpc.sql` : `ziko_get_public_profile(p_user)` borné au contrat (relation, amis, abonnés = amitiés acceptées où le profil est destinataire, niveau/XP/XP restants, série, badges, 3 derniers entraînements, 3 records, 2 défis communs). Jamais de poids/taille/âge/mesures/santé (Q-P21a).
- **SDK** `packages/plugin-sdk/src/friendRelation.ts` (source unique des 4 états, recherche en direct, textes propres) et `friendsApi.ts` (client RPC, repli propre si le RPC n'est pas déployé, `runFriendWrite` qui ne masque plus les erreurs).
- **Community** : `FriendsScreen` réécrit (champ en haut, direct, debounce 250 ms/2 car., pas de bouton Rechercher, compteur, squelettes, `person-add` -> lien d'invitation ; En attente = `Reçues` + `Envoyées` toujours visibles, badge = reçues ; optimiste + rollback + bandeau `Demande non envoyée`/`Réessayer`) ; composant `FriendRelationButton` (bouton plein = `getActionPrimary` #CF4509) ; `store.ts` : `sendFriendRequest` renvoie un résultat (plus d'échec silencieux), accepter/refuser/annuler/retirer vérifient l'effet.
- **Mobile** : `SearchOverlay` utilise le même bouton/RPC (toast, bandeau d'échec) ; profil public `profile/[userId].tsx` refait (bannière 112 dp, avatar 88 dp non rogné, 9 blocs, états D11-D14, `Retirer des amis` avec `showAlert`). Les `é` littéraux du JSX sont supprimés.
- **Tests** : `friendRelation.test.ts` (24), `friendsApi.test.ts` (31), `noJsxUnicodeEscape.test.ts` (40, détecteur + scan de `plugins/community/**` et `apps/mobile/src/components/**`), `backend/api/test/rls/friendships.spec.ts` (RLS, RPC, bornes du profil ; **non exécuté**, exige la base de test).
- `UAT-PLAN.md` (athlete B à ajouter au seed par l'orchestrateur).

## Gate (à l'état final)
`npx vitest run` racine : 34 fichiers, 635 tests verts. `tsc --noEmit` vert : plugin-sdk, plugin-community, apps/mobile. Rendu mobile (`vitest.render.config.ts`) : 39 verts. `check-migration-names` OK. Lint : no-op (pas de config).

## Exigences
| Id | Statut | Preuve |
|---|---|---|
| SOC-01 | PARTIAL | RPC + tests unitaires du client, erreurs non avalées ; envoi réel non exécuté |
| SOC-02/03 | PARTIAL | écran Reçues/Envoyées + badge, logique testée ; rendu non vu sur émulateur |
| SOC-04 | VERIFIED (logique) / PARTIAL (UI) | `deriveRelation`, `relationView` testés (4 états + croisé) ; même composant sur 3 écrans |
| SOC-05 | PARTIAL | debounce/2 car./compteur testés ; focus et position (AM-1) à mesurer |
| SOC-06 | PARTIAL | RPC + normalisation testées ; valeurs en base (PR-4) à vérifier |
| SOC-07 | PARTIAL | structure (overflow visible, zIndex, 44 dp de chevauchement) ; bounds uiautomator à faire (PR-1) |
| SOC-08 | VERIFIED | détecteur + scan de non-régression, textes sans `\u` |

## Deviations et décisions
- Le Bouton `Message`, `Comparer`, `Cadeau` de la liste (absents des maquettes) sont déplacés sur le profil d'un ami pour ne pas supprimer de fonctions : à valider.
- Objectif en français = `goalLabel` (XCUT-01) en minuscules ; donc `santé générale` / `perte de gras` (la maquette dit `santé et bien-être`) : le mapping n'a pas été recréé.
- Badges affichés en icônes Ionicons par palier (`icon` en base = emoji, interdit par la charte). `Voir les N` déplie sur place (pas d'écran dédié).
- `ziko_list_friendships` ajoute le niveau ; sous-titre de ligne = `Niveau N · objectif` (la série n'est pas calculée pour la liste, coût).
- Faille supplémentaire fermée : l'INSERT direct avec `status='accepted'` contournait aussi l'accord (G-04 ne citait que l'UPDATE).
- Série : définition du profil perso (jours consécutifs avec habitude validée, jusqu'à aujourd'hui, Europe/Paris), non plafonnée à 60 jours (le profil perso l'est implicitement) : écart possible seulement au-delà de 60.
- `is_public` n'est pas filtré (parité avec l'existant, Q-P21a = tout connecté). Blocage/signalement non implémentés (placeholder `Signaler, bloquer…` retiré, G-08).
- `friendRequest.ts` (P2) conservé pour ses tests ; plus utilisé par `SearchOverlay`.

## NON prouvé
Aucun test sur émulateur ni base réelle : migrations jamais exécutées (syntaxe PL/pgSQL relue, non compilée), `friendships.spec.ts` non lancé, concurrence A<->B non éprouvée, rendu/positions (AM-1, PR-1), fondu 150 ms et lecteur d'écran, comportement hors-ligne réel. Le repli (RPC absent) est testé en unitaire seulement.

## Besoins humains / orchestrateur
Appliquer les 3 migrations sur la branche de test, ajouter l'athlete B au seed, lancer `npm run test:rls` et l'UAT. Pour la production : montrer le comptage de doublons (requête en tête de `20261201210100`) avant accord. Valider les déviations ci-dessus.

## Conflits possibles
`packages/plugin-sdk/src/index.ts` (2 exports ajoutés), `plugins/community/src/store.ts`, `apps/mobile/src/components/SearchOverlay.tsx`, `profile/[userId].tsx` (P12 lecture seule : pas de conflit attendu).
