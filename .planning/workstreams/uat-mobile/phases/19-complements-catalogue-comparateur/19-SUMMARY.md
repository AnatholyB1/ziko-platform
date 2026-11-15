# Phase 19 : Compléments, catalogue & comparateur : SUMMARY

Branche `phase/19-complements` (base `milestone/v1.20`, mergé en fin de travail). Mobile + 3 migrations (fichiers). Backend non touché.

## Exigences

| Id | Statut | Preuve | Reste non prouvé |
|---|---|---|---|
| SUPP-01 4 onglets | PARTIAL | `SupplementsPlugin.tsx` : `TABS` = Aujourd'hui, Mon stack, Catalogue, Rappels ; type-check mobile vert | rendu réel (UAT SU-1) |
| SUPP-02 recherche + filtres | PARTIAL | `lib/catalog.ts` + `catalog.test.ts` : ilike échappé, `.in` marque/catégorie, `.range` 30, `count: 'exact'`, compteur de la feuille = même filtre que la liste | comportement PostgREST réel, SU-3 |
| SUPP-03 comparateur depuis tout produit | PARTIAL | fiche (route `detail`) atteinte depuis chaque ligne du catalogue ; offres triées, `MEILLEUR PRIX`, prix/jour, lien, date de relevé : `pricing.test.ts` (tri, meilleur prix, ouvrable, date) | ouverture réelle du navigateur (SU-4) |
| SUPP-04 ajout dose + moments | PARTIAL | `AddToStackSheet`, `upsertStackItem` (validation, upsert (user, produit), moments normalisés) : `data.test.ts`, `moments.test.ts` | écriture en base, SU-5 |
| SUPP-05 stack = choix, éditable | PARTIAL | stack lu en base (0 préchargé), état vide C12, crayon + retrait ; le `slice(0, 10)` historique est supprimé | SU-5 sur compte neuf |
| SUPP-06 plus de NaN | VERIFIED (logique) / PARTIAL (écran) | cause : `price_eur`/`per_serving_eur` n'existent pas ; tout passe par `formatPrice`/`formatFromPrice` (null, undefined, 0, `'0'`, chaîne, NaN, négatif = `Prix indisponible`) ; test dédié sur lecture des anciennes colonnes = null | défilement 100 produits (SU-2) |
| SUPP-07 rappels par créneau | PARTIAL | `planNotifications` : 1 par créneau actif non vide, 0 si vide/désactivé, max 3 ; `shiftTime` pas 15 min ; défauts 08:00/13:00/21:30 | notifications réellement planifiées, permission (SU-6) |

## Tests et gate
- `plugins/supplements` : 5 fichiers, 65 tests vitest verts (`npm test` dans le plugin, nouveau script ; pas de nouvelle dépendance, vitest hérité du root).
- `tsc --noEmit` vert : plugin `@ziko/plugin-supplements` et `apps/mobile` (env factice).
- `check-migration-names.mjs` : 3 fichiers OK. Lint mobile = no-op.
- Un faux client Supabase (`__tests__/fakeSupabase.ts`) prouve la construction des requêtes, pas leur exécution PostgREST/RLS.

## Livrables
Migrations (non appliquées) : `20261201190100_supplement_stack.sql`, `20261201190200_supplement_intakes.sql`, `20261201190300_supplement_reminder_prefs.sql` (RLS own, `REVOKE ALL FROM PUBLIC, anon`, `REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN FROM authenticated, service_role`).
Code : `plugins/supplements/src/{lib,components,screens/tabs,hooks.ts}`, `SupplementsPlugin.tsx` (réécrit), `SupplementDetailScreen.tsx` (réécrit : coeur favori remplacé par `Ajouter à mon stack`), `SupplementCompareScreen.tsx` (formatage via helpers). Routes `list`/`detail`/`compare` inchangées.

## Décisions et déviations
- Q-P19 (reco) : favoris non convertis, table conservée mais plus utilisée par l'UI ; Mon stack démarre vide.
- Boutons pleins, puces actives, interrupteurs : `getActionPrimary(theme)` (#CF4509) ; texte d'accent dose/moment/prix `#B53D05` ; aucune photo (tuile `Visuel` pointillée).
- Prix par jour : `price_per_serving` (sinon `price / servings_per_container`) x 1 prise par jour ; l'hypothèse "1 prise/jour" n'est pas la dose du stack. À affiner si besoin.
- Rappels : opt-in (interrupteurs désactivés par défaut, pas de demande de permission à l'ouverture) ; heure réglée par pas de 15 min (stepper) plutôt qu'un sélecteur natif. Permission refusée : bandeau + interrupteurs désactivés.
- Pagination par bouton `Afficher plus` (30 par page) plutôt que FlatList imbriquée dans le ScrollView.
- Pas de mention `Lien partenaire` (G-06, rien d'affilié). Compte à rebours/alertes baisse de prix : hors périmètre.

## Besoins humains
Appliquer les 3 migrations (orchestrateur, après approbation) avant tout UAT ; sans elles, Mon stack/Aujourd'hui/Rappels échouent (le catalogue et la fiche fonctionnent sans).
Dette connue non traitée (G-07) : policies `*_anon_write` sur `ziko_supplements/prices/brands`.

## Fichiers susceptibles de conflit au merge
`plugins/supplements/*` uniquement (plugin isolé). `package.json` du plugin : ajout du script `test`. Aucun changement à `i18n.ts`, `registry.ts`, `PluginLoader.tsx`.
