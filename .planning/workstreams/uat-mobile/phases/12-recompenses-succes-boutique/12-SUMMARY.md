# Phase 12 : Recompenses : Succes & Boutique, SUMMARY

Branche `phase/12-recompenses` (base `milestone/v1.20`, merge de milestone/v1.20 fait, propre). Aucun push, aucune ecriture prod. Mobile seulement.

## Livre
- **Migrations (fichiers seuls, non appliquees)** : `202612011201_badge_award_and_progress.sql` (attribution reecrite -> jsonb, `ziko_get_badge_progress`, `ziko_badge_counters` interne, pieces par palier 25/50/100, source `achievement`) ; `202612011202_equip_item_rpc.sql` (`ziko_equip_item` atomique). SECURITY DEFINER, `search_path` fige, REVOKE PUBLIC/anon, verification `p_user_id = auth.uid()` (ou service_role).
- **Cause racine de "aucun succes attribue"** (trouvee en lisant la fonction d'origine) : elle lisait `ziko_friendships.user_id` (colonne inexistante ; seule `undefined_table` etait rattrapee), donc plantait avant toute insertion. Non reproduit sur la vraie base (lecture du schema de reference seulement).
- **App** : `plugins/gamification` : `rewards.ts` (logique pure), `store.ts` (`awardBadges`, `fetchAchievements`, `fetchCoinHistory`, `equipItem` via RPC), `screens/GamificationPlugin.tsx` (coquille 4 onglets + etat vide Quetes) et `screens/rewards/{chrome,ui,AchievementsTab,ShopTab,LevelTab}.tsx`. `ShopScreen.tsx` supprime (absorbe, D-15) ; routes `gamification/{dashboard,shop}` via `apps/mobile/src/components/RewardsRoute.tsx`. `awardWorkoutXP` appelle `awardBadges` en fin de seance (aucune modif de `workout/session.tsx`).
- Plus aucune liste factice : `STATIC_QUESTS`, badges de secours, `slice(0, 8)` supprimes ; erreur reseau = carte B05.

## Exigences
| Req | Statut | Preuve |
|---|---|---|
| REWD-01 4 onglets + solde (R-1) | VERIFIED (rendu DOM) | render test : ordre des onglets, puce sur chaque onglet |
| REWD-02 11 succes (R-2) | VERIFIED (rendu DOM + SQL) | render : 11 noms, `n / N`, aucun emoji ; vitest : 11 icones distinctes |
| REWD-03 fiche (R-4) | VERIFIED (rendu DOM) | date absente si verrouille, presente sinon |
| REWD-04 attribution auto (R-3) | VERIFIED SQL + logique ; PARTIAL bout en bout | SQL local : 1re seance -> succes + 25 pieces, idempotent, seance vide ignoree ; render : un award fait passer la ligne en Debloques + toast. Chaine reelle seance -> base -> ecran = UAT |
| REWD-05 sans limite de 8 (R-5) | VERIFIED (rendu DOM) | 12 objets affiches, compteur 12 |
| REWD-06 Mes objets / equipement (R-8) | VERIFIED SQL + rendu | 1 seul equipe/categorie (SQL local + DOM) |
| REWD-07 solde permanent | VERIFIED (rendu DOM) | puce sur les 4 onglets |
| REWD-08 historique (R-9) | VERIFIED (rendu DOM) | ordre, emoji retires, pagination `range()` |
| REWD-09 apercu avant achat (R-6/R-7) | VERIFIED (rendu DOM) | CTA desactive + `Il te manque 160 pièces`, achat debite la puce |
| REWD-10 plus de liste factice (R-10) | VERIFIED (rendu DOM) | echec reseau : carte d'erreur, 0 nom de succes/objet/quete factice. Mode avion reel = UAT |

## Decisions appliquees
Q1 : boutons pleins en `getActionPrimary(theme)` + texte blanc. Q6 = A : branding coach prime (route n'appelle pas `setTheme` si `coach:branding` actif ; note affichee). Q7 = A : 25/50/100 par tier, cote SQL, meme transaction. Q8 = A : serie = `GREATEST(current_streak, longest_streak)` (jamais de remise a zero visible : regle non punitive v1.18). D-07..D-16 suivies.

## Tests (comptes)
- vitest unitaires `apps/mobile` : 158 (dont 19 `rewards.test.ts` + 11 `rewardsStore.test.ts`) ; render : 25 (dont 13 `rewards.test.tsx`) ; vitest racine : 28 fichiers verts.
- Harnais SQL `scripts/uat/p12-rewards-sql/run.mjs` : **30 PASS / 0 FAIL** sur un Postgres local jetable (port 8206, arrete ensuite ; `P12_PG_URL` absent = SKIP, URL non locale refusee).
- Gate : `tsc --noEmit` apps/mobile + plugins/gamification = 0 erreur ; `check-migration-names` OK (3 fichiers v1.20 apres merge). Une execution de `npm test` a echoue une fois sans cause identifiee (non reproduite en 2 reexecutions : probable timeout sous charge) ; a surveiller.

## Deviations
- Libelles francais en dur dans le plugin (`rewards.ts`/composants) au lieu d'un namespace `rewards.*` dans `plugin-sdk/i18n.ts` (evite un fichier partage a conflits ; conforme a la convention "les ecrans de plugin codent le francais en dur").
- Schema de test SQL = stub minimal (colonnes copiees du schema de reference), pas le schema portfolio complet.
- Attribution declenchee : fin de seance, ouverture de Recompenses et de l'onglet Succes. Ami accepte / sauvegarde du profil : pas de hook dans les fichiers des phases P21/P6 ; le succes est attribue a la prochaine ouverture de Recompenses (ou du Profil, appel existant inchange).
- Seance "comptee" cote SQL = au moins une ligne `ziko_session_sets` (P6 D-02) ; records = exercices distincts avec charge > 0 (definition du Profil). A realigner si P6 change la regle.

## NON prouve
Rendu natif (le stub DOM ignore styles, accessibilite, Modal natif) ; animations 250/150 ms et reduced-motion ; TalkBack ; contraste mesure ; theme/banniere reellement appliques au runtime ; comportement sur la vraie base (grants, RLS, donnees existantes : les `user_badges` historiques ne sont pas touches) ; migrations jamais appliquees hors Postgres local ; `ziko_award_coins`/`ziko_purchase_shop_item` restent appelables par un client avec un `p_user_id` arbitraire (faille existante, hors perimetre, a signaler).

## Besoins humains
Approbation + application des 2 migrations (ordre 1201 puis 1202) avant l'UAT ; seeds UAT (12 badges en boutique, solde manipule, compte lie a un coach) ; relire la maquette B05 de la carte d'erreur contre le rendu natif.

## Fichiers a risque de conflit
`plugins/gamification/src/screens/GamificationPlugin.tsx` (P13 reecrit `QuestsTab` ici : composant isole en tete de fichier) ; `plugins/gamification/src/store.ts` ; `apps/mobile/app/(app)/(plugins)/gamification/*.tsx`. Profil `profile/index.tsx` non modifie (son appel RPC reste compatible avec le nouveau retour jsonb).
