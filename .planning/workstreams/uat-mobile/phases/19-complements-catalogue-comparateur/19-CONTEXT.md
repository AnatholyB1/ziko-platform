# Phase 19 : Compléments, catalogue & comparateur - Context

**Gathered:** 2026-11-12 (discuss w2b : scout du code réel + maquettes lot C). Req : SUPP-01..07. Vague 2. UI hint oui. **Maquette : lot C C10-C18** (contrat §1 Compléments, §5 SU-1..6, valide). Dépend de P4 (fait). Aucune dépendance de fichier avec les autres phases (plugin isolé).
`[A CONFIRMER]` = recommandation du discuss à valider ; sans marque = déjà décidé.

## Décisions verrouillées (recap + contrat de design)
- **D-01** SUPP-01 : 4 onglets, **ordre imposé** `Aujourd'hui / Mon stack / Catalogue / Rappels` (aujourd'hui 3 onglets, `TABS` l.22 de `SupplementsPlugin.tsx`).
- **D-02** SUPP-02 : Catalogue = recherche live + 2 filtres (Marque, Catégorie) en feuille multi-choix, compteur de résultats, bouton `Afficher N produits`, état vide C18. Données : 1 624 produits, 11 marques, 12 catégories (constat recap, base lue au recap).
- **D-03** SUPP-03 : le comparateur redevient accessible depuis **tout produit** du catalogue (`SupplementDetailScreen` + `SupplementCompareScreen` et routes `detail`/`compare` existent déjà mais plus aucune entrée). Offres triées par prix, badge `MEILLEUR PRIX`, prix par jour, `Voir l'offre` ouvre le navigateur, offre sans prix = `Prix non communiqué` non cliquable, mention de date de relevé.
- **D-04** SUPP-06 : **jamais** `NaN€` ni `0 €` pour "inconnu" : `dès 14,90 €` ou `Prix indisponible`. Formatage dans une fonction pure testée (cas null / undefined / 0 / chaîne numérique).
- **D-05** SUPP-04/05 : ajout au stack = dose (stepper) + **un ou plusieurs moments** (puces multi-choix Matin/Midi/Soir). `Mon stack` = **uniquement** les produits choisis (0 préchargé sur compte neuf, SU-5), dose + moment en `#B53D05`, crayon pour modifier, état vide C12.
- **D-06** SUPP-07 (tranchée par la maquette, D-04a) : rappels **par créneau** Matin/Midi/Soir, un interrupteur + une heure par créneau (défauts 08:00 / 13:00 / 21:30), **un** rappel par créneau listant les produits, créneau sans produit = aucune notification, désactivé = `Rappel désactivé`. 3 notifications locales max par jour.
- **D-07** `Aujourd'hui` = prises du jour groupées Matin/Midi/Soir, cochables, `3 sur 5 pris`.
- **D-08** Charte : Ionicons, inline styles, `showAlert`, pas d'emoji, aucune photo (tuile `Visuel` pointillée si pas d'image), `paddingBottom: 100`.

## Gray areas (reco + `[A CONFIRMER]`)
- **G-01 Cause du `NaN€` (constat, pas une question).** Dans `SupplementsPlugin.tsx` (l.45-46, 366, 372-374) le code lit `price_eur` / `per_serving_eur`, colonnes qui **n'existent pas** : le schéma `ziko_supplement_prices` a `price` et `price_per_serving` (les écrans Compare/Detail utilisent déjà les bons noms). Correction = renommer + helper de formatage ; pas de migration. Vérifier aussi les produits sans ligne de prix (`supplement_prices` vide) -> `Prix indisponible`.
- **G-02 Stack et prises persistés en base** (aujourd'hui : stack = 10 premiers produits triés par nom, coches en `AsyncStorage`). Reco `[A CONFIRMER]` : tables `ziko_user_supplement_stack` et `ziko_supplement_intakes` ; le critère SU-5 se vérifie "en base" et le multi-appareil l'exige.
- **G-03 Favoris existants** (`ziko_user_supplement_favorites`, coeur dans `SupplementDetailScreen`) : voir question Q-P19. Reco : le coeur devient `Ajouter à mon stack` ; la table n'est plus utilisée par l'UI ; **pas de conversion automatique** (pas de dose/moment connus).
- **G-04 Recherche/pagination** : catalogue de 1 624 lignes : requête Supabase directe depuis le mobile (cohérent avec CLAUDE.md), `.range()` par pages de 30, compteur via `count: 'exact'` ; ne pas charger tout le catalogue. Alternative : route Hono `GET /supplements/search` (existe, `backend/api/src/routes/supplements.ts`) : écartée (un aller-retour de plus, pas de gain). `[A CONFIRMER]`.
- **G-05 Rappels = notifications locales** (`expo-notifications`, modèle `plugins/habits/src/notifications.ts`), reprogrammées à chaque changement d'heure/stack (SU-6 : +-1 min). Aucun push réel en test. Permission refusée : message + interrupteurs désactivés, pas d'échec silencieux.
- **G-06 "Lien partenaire"** (CRITIQUE Q5) : `source_url` vient du scraper, pas d'affiliation : **aucune mention** aujourd'hui ; ajouter la mention le jour où des liens affiliés sont posés. `[A CONFIRMER]` (réversible, pas de coût).
- **G-07 Hors périmètre signalé** : policies `*_anon_write` sur `ziko_supplements/prices/brands` (le cron scraper écrit avec la clé anon) : dette de sécurité déjà tracée en FOLLOW-UP de `20261107170000` ; ne pas y toucher ici.

## Code context (scouté)
- `plugins/supplements/src/screens/SupplementsPlugin.tsx` (437 l.) : onglets, checklist (`AsyncStorage` clé `supplements_daily_{userId}_{date}`), recherche ilike sur `ziko_supplements` avec jointure `ziko_supplement_prices(*)`, rappels en dur (`reminders` + `Switch` en état local non persisté).
- `SupplementDetailScreen.tsx` (310 l.), `SupplementCompareScreen.tsx` (257 l.), `store.ts` (122 l.) : `favorites`, `compareList`, `SupplementPrice.price_per_serving` ; routes `apps/mobile/app/(app)/(plugins)/supplements/{list,detail,compare}.tsx`.
- Schéma prod : `ziko_supplements` (brand_id, category_id, name, serving_size, servings_per_container, image_url…), `ziko_supplement_prices` (price, price_per_serving, source, source_url, in_stock, scraped_at), `ziko_supplement_brands`, `ziko_supplement_categories`.
- Backend : `backend/api/src/routes/supplements.ts` (catalogue côté scraper/cron) ; pas d'outil IA supplements à modifier.

## Migrations (bloc `202612011901`-`202612011909`, fichiers seulement, REVOKE explicite TRUNCATE/REFERENCES/TRIGGER/MAINTAIN sur chaque nouvelle table)
- `202612011901_supplement_stack.sql` : `ziko_user_supplement_stack` (id, user_id, supplement_id FK, dose numeric > 0, dose_unit text, moments text[] CHECK sous-ensemble {morning,noon,evening} non vide, created_at, UNIQUE(user_id, supplement_id)) ; RLS `auth.uid() = user_id`.
- `202612011902_supplement_intakes.sql` : `ziko_supplement_intakes` (user_id, supplement_id, moment, date local, taken_at, UNIQUE(user_id, supplement_id, moment, date)) ; RLS own.
- `202612011903_supplement_reminder_prefs.sql` : `ziko_supplement_reminder_prefs` (PK user_id+moment, enabled, remind_time time) ; RLS own ; lignes par défaut créées côté client à la première ouverture (pas de seed).

## Références canoniques
`lot-C/DESIGN-CONTRACT.md` (§1, §2 C10-C18, §3, §4, §5 SU-1..SU-6, §6) ; `lot-C/02-complements.html` ; `lot-C/CRITIQUE.md` (Q3 et Q5) ; `shared/DESIGN-SYSTEM.md` ; `supabase/migrations/README-v1.20.md` ; `.planning/MILESTONE-RECAP-2026-11-12.md` §11.

## Vérification (rappel)
Tests unitaires : `formatPrice`, tri des offres, prix/jour, mapping moments, construction des créneaux de rappel. Script SU-2 : 100 produits défilés, 0 `NaN`/`undefined`. UAT émulateur en file : SU-1..SU-6 (SU-6 via liste des notifications planifiées), ouverture du lien externe.

## Deferred
Liens affiliés + mention `Lien partenaire`. Alertes baisse de prix. Scan code-barres produit. Passage du scraper en client service-role.
