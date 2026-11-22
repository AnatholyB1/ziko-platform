# UAT correctifs TestFlight (4 bugs) — 2026-11-20

Branche `fix/testflight-4-bugs` (worktree `C:\ziko-fix`), 4 commits au-dessus de `origin/main` (0 de retard).
Cible : emulateur Android `ziko-uat-1`, dev-client + Metro 8281, backend local 8200 avec faux Anthropic/Upstash,
base Supabase jetable `uat-v1-20`. La production n'est pas touchee.

| # | Bug | Commit | Verification | Resultat |
|---|-----|--------|--------------|----------|
| 1 | Premiere conversation Ziko en boucle (`cap_reached`) | 7ab66291 | Maestro `tf-b-first-conversation` | OK. Ziko repond au 1er tour, la carte « TA PREMIERE MISSION » apparait au 2e, aucun « On dirait qu'on tourne en rond » |
| 2 | Mission absente de l'accueil d'un compte neuf | cbabe60a | Maestro `tf-c-home-mission-ai-programs` | OK. Carte « Mission du jour / Bois un premier verre d'eau / C'est parti » visible sur l'accueil |
| 3 | Programmes IA verrouille (minLevel 4) | b61d4ab4 | Maestro `tf-c-home-mission-ai-programs` (lien profond) | OK. L'ecran « Programmes IA » s'ouvre au niveau 1 |
| 4 | Coach IA : generation de seance en echec, pas de « Credits epuises » | 398fb972 | Tests unitaires uniquement (6 tests de la route) | NON verifie sur emulateur |

Tests : backend/api 581 OK, racine (dont plugin-sdk) 1246 OK, `tsc` propre sur backend/api, plugin-sdk, apps/mobile.
Aucune comparaison avec `origin/main` : impossible de dire si un echec serait ancien ou nouveau, mais aucun test n'echoue.

## Observations
- Le CTA de la carte mission de la conversation ouvre directement Hydratation (apres l'ecran de pre-permission notifications), il ne renvoie pas a l'accueil.
- Le faux Anthropic renvoie un 500 sur `/ai/onboarding/retroactive` (pas d'objet structure). Limite du faux, pas une regression.
- Sur l'emulateur Android, le clavier recouvre la ligne de saisie du chat d'onboarding : le flow doit appeler `hideKeyboard`. A confirmer sur iOS reel.

## Limites
- Android, alors que TestFlight est iOS : le JS et le backend sont les memes, mais le rendu natif iOS n'est pas prouve.
- Le faux Anthropic ne prouve ni la qualite des reponses du vrai Claude, ni le seuil de 6 tours.
- Programmes IA : non installe automatiquement apres l'onboarding (apparait dans le drawer apres installation depuis le store).

## Defaut ancien, non corrige
Le coach peut assigner une premiere mission « journal » ou « mesures », or ces plugins ne se debloquent qu'au niveau 2 : le CTA de la conversation renverrait a l'accueil. Piste : limiter la premiere mission a l'hydratation cote backend.
