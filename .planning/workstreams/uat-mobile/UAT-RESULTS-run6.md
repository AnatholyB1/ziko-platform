# UAT run 6 : re-verification run 5 + flows restants (branche uat/run6, base milestone/v1.20 b03fbb4d, inclut fix/uat-run5)

Env : emulateur ziko-uat-1, Metro 8281, backend 8200 + faux Anthropic (aucun appel reel), branche Supabase `uat-v1-20` (ref oloobswzsziidjwycthm verifie avant chaque ecriture). Captures : `uat-evidence/run6/` (gitignore). Session arretee par budget de contexte : beaucoup de flows NON-TESTE (voir `UAT-RUN6-RESUME.md`).

## (1) Re-verification des corrections du run 5

| Correction | Verdict | Detail |
|---|---|---|
| P24 `Squat` -> `barbell full squat` (sans fixture, ligne `Back Squat` supprimee) | PASS | programme "Bloc de volume" : l'apercu et la seance affichent "Squat complet barre" (1 exercice, 5x5). Toast "Exercice remplace" : NON observe (capture trop tardive, ecran deja affiche). |
| Accueil avec programme coach actif | PASS partiel | plus de "Aucun programme actif" : carte "Force 5x5, bloc 2 - 0 exos - ~30 min". "0 exos" = la fixture coach n'a aucune seance/exercice (donnee, pas code). Programme IA actif : "Force - 1 exos" OK, demarrage OK. |
| Objectif d'eau stable a froid x3 | PASS | `2.6L / 2.0L` identique sur 3 relances a froid (valeur 2.0 L, differente du 2.5 L de run 5 mais STABLE). |
| Ouverture hors ligne (wifi+data coupes, demarrage a froid) | FAIL | ecran "Bienvenue" (onboarding) au lieu de l'app. Cause : `apps/mobile/app/(app)/_layout.tsx:252` `if (!profile?.onboarding_done) return <Redirect href="/(auth)/onboarding/step-1" />` : hors ligne `refreshProfile` echoue, `profile` reste null (non persiste) donc redirection onboarding, meme si la session persistee est relue (`authStore.ts:199`). Au retour du reseau la session est intacte. |
| P7 "Pas encore demarre" | NON-CONFIRME | aucune etiquette de statut visible sur les lignes "Autres programmes" ni sur le detail (dump uiautomator) ; `programStatus.ts` non verifie a l'ecran. |
| Bandeau P24 apres reactivation | NON-TESTE | |
| Tap sur "Obligatoire" (MC-11) | NON-TESTE | |
| Mention "Ce profil est prive" | NON-TESTE | |

## (2) P26 Ligue / defis collectifs
| Critere | Verdict | Detail |
|---|---|---|
| LG-17 creation par le coach + affichage chez A | PASS | `POST /league/collective` 201 (3 defis), carte "Defis de groupe" avec `Rejoindre` / `Pas cette fois`. |
| LG-21 garde-fous API | PASS | non-coach 403 `not_a_coach` ; `weight_kg` 400 `invalid_arguments` ; 4e defi actif 409 `too_many_active_challenges`. (Une validation de corps precede l'autorisation : titre trop court -> 400 avant 403.) |
| LG-18/19 contribution | PASS (contribution) / FAIL (total) | apres Rejoindre + 500 ml (outil faux) + 9000 ml le jour + 3000 ml la veille : "Ma contribution : 4000" (plafond 4000/jour, veille ignoree) PASS. Mais "Groupe : 0 / 10000 ml" pour 1 participant : la RPC renvoie `total=NULL, total_hidden=true` (< 3 participants, migration 2703) et l'UI (`plugins/community/src/league/rules.ts:~192`, `cards.tsx`) ne traite jamais `total_hidden` : affiche un 0 trompeur + barre a 0 %. Attendu : "Total masque jusqu'a 3 participants". |
| LG-22 isolation | PARTIEL | PATCH `ziko_league_state`, POST `ziko_league_weeks`, POST `ziko_collective_participants` -> 403 (42501). Colonnes `faction_id`/`contribution` et signatures RPC supposees inexactes : inconclusif pour ces 2 + RPC. |
| LG-5 | ECART | "Piste Habitudes - Bronze - Cette semaine : 0 sur 28 habitudes" (plan : sur 21). |
| LG-1..4, 6..16, 20, 23..25 | NON-TESTE | |

## (4)/(5) Seance, accueil
| Critere | Verdict | Detail |
|---|---|---|
| P6 A : "Allez, c'est parti !" ouvre la seance prevue | PASS | apercu "Squat complet barre" ; seance creee `name="A"` (nom peu parlant, `program_id` null). |
| P6 C : Terminer sans serie | PASS | dialogue "Aucune serie n'a ete validee : la seance ne sera pas enregistree" (titre "Fin de l'entrainement", plan : "Seance non enregistree"). |
| P6 C variante : 1 serie validee puis Terminer | PASS | ligne en base `total_sets=1`, `total_volume_kg=500`; ecran "Seance terminee" FR, icones Ionicons ; ecarts de libelle : "1 series completees" (pluriel), bloc "HIGHLIGHT" en anglais. |
| P6 : "Sauvegarder & fermer" | FAIL (critique) | affiche "Unmatched Route ziko:///" + erreur "Cannot update a component (ForwardRef(Navigator))". Cause : `apps/mobile/app/(app)/workout/summary.tsx:63` `router.replace('/(app)/(tabs)/workout')` : le groupe `(tabs)` n'existe pas (onglets a plat sous `(app)`) ; et `summary.tsx:31` `router.replace` pendant le rendu. |
| Seance fantome | ECART | un 2e demarrage laisse une seance ouverte `ended_at null` (b352...) qui subsiste tant qu'on ne relance pas l'app. |
| Accueil apres seance (Charge 2/4) | PASS apres relance / invalidation NON-TESTE | la navigation cassee (ci-dessus) empeche de verifier l'invalidation sans relance. Badge streak "1 jours" (pluriel). |
| Accueil kcal | ECART | "490 kcal" sans objectif (l'eau affiche "2.6L / 2.0L"). |
| Quick Log, FAB bug, noms FR exercices | NON-TESTE (noms FR : "Squat complet barre" PASS) | |

## Autres observations
- `/credits/balance` : `daily_earned 6` > `daily_cap 4` apres un outil de chat (plafond depasse ou champ different ?).
- Dump uiautomator : "could not get idle state" pendant l'anneau animee de la seance (utiliser captures).
- Non-teste : P16 IM-*, P9, P10, P11, P15, P17, P20, P22, P23 (feuille d'epuisement), P24 B..F, quete a 21 h, comparaison aux maquettes (aucun ecart mesure releve).

## Etat laisse sur la branche
Programme coach "Force 5x5, bloc 2" actif ; "Bloc de volume" inactif ; ligne catalogue `Back Squat` supprimee ; 3 defis collectifs actifs (coach) dont A a rejoint "Defi eau du groupe" ; logs d'eau A : +500 ml, +9000 ml (aujourd'hui), +3000 ml (hier) ; 2 seances A du jour (une terminee 500 kg, une ouverte).
