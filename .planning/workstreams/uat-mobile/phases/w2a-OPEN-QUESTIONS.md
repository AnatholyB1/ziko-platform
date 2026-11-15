# w2a : questions ouvertes (phases 7, 9, 10, 12, 17)

9 questions, toutes phases confondues. Recommandation en premier ; si l'utilisateur ne repond pas, le builder applique la recommandation (deja ecrite dans chaque `NN-CONTEXT.md`, marquee `[A CONFIRMER]`). Aucune decision du recap n'est redemandee. Tout le reste des zones grises est tranche technique (voir les CONTEXT).

**Q1 (P7, P9, P10, P12, P17) Orange des boutons d'action.** Blanc sur `#FF5C1A` = 3,09:1 (echec AA) ; les lots A/B sont rendus en `#FF5C1A`, les lots C/D (donc P17) en `#CF4509`. Une seule valeur pour tout le produit.
- A (recommande) : un token d'action `#CF4509` pour les fonds de boutons/indicateurs (blanc dessus 4,66:1), `#FF5C1A` reste la couleur de marque pour icones/accents ; une ligne de token, pas de re-rendu des maquettes.
- B : garder `#FF5C1A` + libelle blanc 16 sp gras (exception AA acceptee, fidele a la charte).
- C : garder `#FF5C1A` + libelle `#1C1A17` (5,6:1, boutons a texte noir).
Impact : token theme + captures UAT de toutes les phases UI.

**Q2 (P7) Activer un programme IA/perso alors que le programme du coach est actif.**
- A (recommande) : permis avec confirmation ecrite a deux boutons (`Garder le programme du coach` / activer le sien) ; le coach voit le changement dans le CRM.
- B : programme du coach verrouille (impossible de l'ecraser tant que le coach est lie).
- C : permis sans confirmation.
Impact : ecran A08, regle de la fonction SQL d'activation, test de conflit.

**Q3 (P9) Cout affiche de la methode Photo (estimation IA d'un repas).** Le contrat dit `1 credit IA par analyse` ; le gate reel `scan` coute 3 credits (1 scan gratuit/jour).
- A (recommande) : afficher le cout reel lu dans la config (3 credits, 1er scan du jour gratuit), pas de chiffre en dur.
- B : passer `scan` a 1 credit (change l'economie v1.4, cible 0,75 EUR/mois).
- C : texte generique `Consomme des credits IA`.
Impact : microcopy A19 + eventuellement `config/credits.ts`. (A noter pour P23 : meme ecart `1 credit par message` vs `chat = 4`.)

**Q4 (P9) Favoris d'aliments dans l'ecran repas.** A17 montre "recents/favoris".
- A (recommande) : Recents seulement (derives des 14 derniers jours de logs, 0 migration) ; favoris reportes.
- B : Favoris persistes (table `ziko_food_favorites`, bloc 0901).
Impact : migration, RLS, 1 ecran de gestion.

**Q5 (P10) Credits des recettes IA du Garde-manger.** La route actuelle n'a AUCUN gate de credits (modele Sonnet) ; le contrat annonce 1 credit.
- A (recommande) : nouvelle action `recipes` = 1 credit + 1 generation gratuite par jour, via `creditCheck`/`creditDeduct`.
- B : reutiliser `chat` (4 credits).
- C : laisser gratuit (cout API absorbe).
Impact : `config/credits.ts`, route backend, etat 402, bouton.

**Q6 (P12) Theme achete et branding du coach.** Un athlete coache voit deja le theme du coach.
- A (recommande) : le branding du coach prime tant qu'il est actif ; le theme achete reste equipe et s'applique au delien, avec message.
- B : le theme achete l'emporte.
- C : equipement de theme desactive pour un athlete coache.
Impact : logique `useThemeStore`, fiche d'equipement.

**Q7 (P12) Pieces gagnees a l'obtention d'un succes.** La fiche affiche une "recompense en pieces" mais rien n'en credite aujourd'hui.
- A (recommande) : par palier (tier 1 = 25, tier 2 = 50, tier 3 = 100 pieces), cote SQL dans la meme transaction que l'attribution.
- B : aucune piece (fiche sans recompense).
- C : montants fixes plus eleves (ex. 50 / 100 / 250).
Impact : fonction SQL, CHECK `ziko_coin_transactions.source` (+ `achievement`), economie.

**Q8 (P12) Definition de la serie pour les succes Streak 7/30/100.**
- A (recommande) : la serie visible (`current_streak`/`longest_streak` de `ziko_user_gamification`, jours d'entrainement ou de check-in).
- B : garder le calcul actuel de la fonction (jours consecutifs avec une ligne d'habitude uniquement).
Impact : fonction SQL d'attribution, texte `Encore 2 jours ...`.

**Q9 (P17) Reglage "Reveil intelligent" (fenetre 30 min).** Pas d'API d'alarme fiable dans l'app.
- A (recommande) : preference enregistree et editable, libelle honnete `S'activera avec une source connectee`, aucune notification simulee.
- B : notification locale douce au debut de la fenetre avant l'heure de lever cible.
- C : retirer la ligne des reglages.
Impact : reglages C29, planification de notifications, honnetete des captures UAT.

## Prerequis humains / lecture seule a faire par l'orchestrateur (pas des questions produit)
- P10 : verifier en prod (lecture seule) que `ziko_shopping_list_items` et le type `ziko_shopping_item_source` existent (le fichier `20261108000000_ziko_shopping_list.sql` se declare non applique) ; sinon l'appliquer avant le bloc 1001.
- P7 : verifier si des doublons `is_active` existent deja (lecture seule) avant la migration d'unicite ; verifier que `ziko_ai_generated_programs` impose bien `name`/`split_type`/`days_per_week` NOT NULL (le builder 4 etapes ne les renseigne pas).
- P12 : relever `ziko_badge_definitions` / `ziko_user_badges` / `ziko_coin_transactions` en prod (nombre de lignes, CHECK source) avant d'ecrire la migration 1201.
