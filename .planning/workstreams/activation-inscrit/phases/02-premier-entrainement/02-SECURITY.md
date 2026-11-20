# Phase 2 : audit securite (audit/phase-2)

Perimetre : code mobile ajoute par la phase (aucun backend, aucune migration, aucun nouvel endpoint).

| Sujet | Resultat |
|---|---|
| Secrets | Aucun secret ajoute. `EXPO_PUBLIC_API_URL` seul lu ; jeton Supabase de session envoye en Bearer a `/ai/workshop/info` (endpoint existant, authentifie, `clientForUser`). Aucun `SERVICE_ROLE` importe. |
| Autorisation | `ziko_workout_sessions` lue en `count/head` avec `.eq('user_id', userId)` sous RLS ; aucune lecture inter-utilisateur. `getActiveProgram` (existant) interpole l'uuid de session dans `.or()` : source = session authentifiee, pas de saisie libre. |
| Injection | `COUNTABLE_SESSION_OR_FILTER` est une constante. Aucun HTML, deep link ni `router.push` construit a partir d'une entree utilisateur (routes statiques de `FIRST_WORKOUT_PATHS`). |
| Controle de credit | Le client n'est qu'indicatif : le blocage reel reste `creditCheck/creditDeduct` cote serveur (ai.ts:580, atelier). Un client falsifie qui masque l'etat « epuise » obtient un 402. Un client qui l'affiche a tort n'y gagne rien. Aucune ecriture de credit cote client. |
| Fuite d'information | Solde et cout affiches a leur proprietaire uniquement ; `console` non ajoute. |
| Onboarding | `handleFinish` inchange (upsert profil de l'utilisateur courant, `onboarding_done`). Les textes ne promettent plus un plan inexistant (reduction du risque de tromperie, CLAR-02). |
| Deni de service / charge | `GET /ai/workshop/info` appele a chaque focus d'accueil tant que la carte est visible (LOW, voir REVIEW). Limite par staleTime 60 s hors focus. |

Constats : 0 critique, 0 haut, 0 moyen, 1 faible (charge ci-dessus). Non verifie : comportement reel du 402 et de l'endpoint (doubles de test uniquement).
