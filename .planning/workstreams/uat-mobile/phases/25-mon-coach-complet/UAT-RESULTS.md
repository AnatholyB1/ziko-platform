# UAT-RESULTS P25 (run3, 2026-11-13, branche de test uat-v1-20)
Emulateur + liens profonds `ziko://coach/dashboard`, SQL branche, API REST avec le JWT de uat-athlete (script local `uat-evidence/rls25.mjs`).

## FAIL majeur
**MC-8 FAIL - le retrait cote athlete ne revoque RIEN** : l'app affiche l'alerte "Coach retire" mais `ziko_coach_client_links.revoked_at` reste NULL (verifie en SQL) et l'ecran reste en etat C. Cause : `backend/api/src/coach/clients/service.ts:298` `DELETE /links/:clientId` (revocation COACH) est enregistre AVANT `DELETE /links/:id` (l.313, athlete) ; Hono prend la premiere route : `revokeClientLinkByCoach(jwt, userId(=athlete), <id du lien>)` filtre `coach_id = athlete` et `client_id = <id du lien>` -> 0 ligne, pas d'erreur, reponse `{ok:true}` -> l'app (`plugins/coach/src/screens/CoachScreen.tsx:339-353`) croit au succes. Le commentaire du code ("Both are safe independently") ignore que les deux chemins sont identiques. Journal backend : `DELETE /coach/clients/links/7a39... 200`. Correctif suggere : route distincte (ex. `/links/:id/self`) ou un seul handler qui teste coach_id puis client_id. Aussi : `revoked_by='client'` n'est jamais positionne par ce chemin (seulement par mes UPDATE REST directs).

## Matrice MC
| Id | Verdict | Detail |
|---|---|---|
| MC-1 etat A | PASS | champ code "XXXXXX", "Valider le code" ; ANCIENS COACHS affiche seulement avec historique. Couleur #CF4509 non mesuree. |
| MC-2 etat B | PASS (ecarts) | nom, badge "Certifie KYC", bio, "Lier mon compte". Ecart : bouton secondaire "Retour a la saisie" (plan : "Annuler"). Specialites non affichees (donnee absente ?). |
| MC-3 lien | PASS | CoachCard + "Programme de ton coach" ; nouvelle ligne revoked_at NULL. |
| MC-4 | PARTIEL | statut "Actif" quand le programme coach est actif ; "3 seances par semaine · semaine 3/8" ; "Voir le programme" present ; "Disponible" non rejoue. |
| MC-5 | PASS | programme perso actif -> "Remplace par ton programme" ; "Reprendre" -> alerte (corps : "Ton programme actuel sera mis en pause. Tu pourras le reprendre depuis Mes programmes.", Remplacer/Annuler) ; Annuler : rien ; Remplacer -> "Actif", coach is_active=true, IA=false (1 seul actif). Titre de l'alerte non capte par le dump. |
| MC-6, MC-11, MC-13 | NON-TESTE | |
| MC-7 modale | PASS | "Retirer ton coach ?", texte "...conserves... nouveau code", "Tape COACH pour confirmer", "Retirer" non cliquable avec "COAC", cliquable avec "COACH", "Garder mon coach". |
| MC-8 | FAIL | voir ci-dessus. |
| MC-9 historique | PASS | (lien revoque par SQL) etat A : "ANCIENS COACHS" replie ; deplie : "UAT Coach / du 12 nov. 2026 au 13 nov. 2026". Limite 5 lignes non testee. |
| MC-10 re-lien | PASS | nouveau code (invitation UAT777 creee en SQL) -> nouveau lien actif, ancien conserve (2 lignes), aucun delai. |
| MC-12 | PASS | `DELETE ziko_user_plugins?plugin_id=eq.coach` avec le jeton athlete -> 403 `42501 mandatory plugin cannot be uninstalled`. |

## Attaques RLS sur la branche (API REST, JWT uat-athlete)
| Attaque | Resultat |
|---|---|
| UPDATE coach_id d'un lien | 403 `42501 coach link identity is immutable` : BLOQUE |
| UPDATE client_id d'un lien | 403 `42501 coach link identity is immutable` : BLOQUE |
| DELETE du lien | 403 `42501 permission denied` (pas de GRANT DELETE) : BLOQUE |
| DELETE plugin `coach` | 403 `42501 mandatory plugin cannot be uninstalled` : BLOQUE |
| Revocation legitime directe (revoked_at + revoked_by='client') | 200 (autorise ; contourne le bug backend) |
| Remettre revoked_at/revoked_by a NULL apres revocation | 200 avec 0 ligne ; etat relu inchange : BLOQUE |
Aucune attaque n'a reussi. Branche restauree ensuite (lien actif, par SQL service_role).

## Run 8 (2026-11-13) - re-vérification 401 Mon coach
PASS : athlète banni 60 s (`sim-session-expiry.mjs --seconds=60`, nécessite `UAT_SUPABASE_URL` exporté), ouverture de Mon coach -> message `Session expirée` (et non une coupure réseau) (`uat-evidence/p25/coach401b.png`). Avant le ban, même écran = `Ton coach depuis le 13 nov. 2026`.
