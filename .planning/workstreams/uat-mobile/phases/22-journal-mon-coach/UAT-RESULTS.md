# UAT-RESULTS P22 (run2, 2026-11-13)

| Id | Verdict | Detail |
|---|---|---|
| Journal | PASS | "Humeur deja notee aujourd'hui depuis l'accueil : Bof. Ton enregistrement la met a jour." (Q-P22b), echelles Humeur/Energie/Stress. |
| Mon coach | PASS partiel | "UAT Coach - IDENTITE VERIFIEE - Ton coach depuis le 12 nov. 2026", Seances 0 / Habitudes 0 %, "Retirer ce coach". Reste NON-TESTE. |

## Run 7 (2026-11-13)
| Id | Verdict | Preuve |
|---|---|---|
| JR-4 Quick Log -> Journal `Général` | PASS | bandeau `Humeur déjà notée aujourd'hui depuis l'accueil : Bof. Ton enregistrement la met à jour.`, bouton `Mettre à jour`, base : 1 seule ligne `general`, mood mis a jour |
| JR-6 session expiree | NON-TESTE | `POST /auth/v1/logout?scope=global` revoque le refresh token mais PostgREST accepte encore le JWT (~1 h) : l'ecriture Journal reussit, aucun bandeau. Simulation insuffisante : attendre l'expiration du JWT ou reduire `jwt_exp` sur la branche |
| Constat lie | FAIL | apres ce logout global, le backend repond 401 (`/coach/clients/links/me`) et Mon coach affiche `Impossible de charger / Vérifie ta connexion, puis réessaie.` : un 401 est presente comme un probleme reseau, ni bandeau `Session expirée` ni redirection login (p22-coach.png) |
| CO-1 Mon coach lie | PASS | `UAT Coach`, `Ton coach Ziko`, `IDENTITÉ VÉRIFIÉE`, `Ton coach depuis le 13 nov. 2026`, 2 stats, bloc programme (p22-coach2.png) |
| CO-5 coupure reseau | NON-TESTE | donnees en cache affichees |
| JR-1/2/3/5/7/8, CO-1b..4 | NON-TESTE | |
