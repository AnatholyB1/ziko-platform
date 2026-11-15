# P25 Mon coach : UAT run 4 (branche uat/run4, emulateur, branche Supabase uat-v1-20)

Correctif verifie : FIX-UAT-RUN3 point 1 (MC-8, route unique `DELETE /coach/clients/links/:id`).

| Critere | Resultat | Preuve |
|---|---|---|
| MC-8 retrait par l'athlete (id = `ziko_coach_client_links.id`, JWT athlete) | PASS | HTTP 200 `{"ok":true,"revoked_at":...,"revoked_by":"client"}` ; SQL : lien `dabac2d1` `revoked_at` renseigne ET `revoked_by='client'` |
| MC-8 lien deja retire | PASS | meme DELETE rejoue sur `7a396aff` (retire au run3) : 404 `Link not found or already revoked` |
| MC-8 id inconnu | PASS | 404 identique (jamais 200 pour 0 ligne) |
| MC-8 revocation cote coach (id = `client_id`, JWT coach) | PASS | lien de fixture insere puis DELETE coach : 200 `revoked_by:"coach"` ; rejoue : 404 |
| Retrait via le bouton mobile (ecran Mon coach) | NON-TESTE | verifie par API uniquement (le mobile envoie `link.id`, meme route) ; theme coach retire non rejoue en UI |
| MC-4, MC-6, MC-11, MC-13 | NON-TESTE | budget de contexte |

Etat laisse : athlete SANS lien coach actif (2 lignes revoquees client + 1 revoquee coach).
