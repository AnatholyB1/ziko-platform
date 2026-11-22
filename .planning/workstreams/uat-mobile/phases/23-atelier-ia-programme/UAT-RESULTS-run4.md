# P23 Atelier IA / credits : UAT run 4

| Critere | Resultat | Preuve |
|---|---|---|
| Quota gratuit : chaque tour consomme un slot (ledger avant/apres) | FAIL | 4 appels `POST /ai/chat` (athlete tier `free`, flag `premium_credit_cap_enabled` absent, solde 20), tous 200 ; AVANT et APRES : `ziko_ai_credit_transactions` inchange (derniere ligne 2026-11-13 02:58 UTC, aucune ligne `type='quota'`/`source='chat'` creee ce jour a 13:0x) ; solde 20 inchange ; backend.log sans erreur `trackQuotaUsage`. Le quota gratuit reste donc illimite. Pistes : `backend/api/src/middleware/creditGate.ts:165-181` (branche `creditPassThrough`) -> `creditService.ts:255-271` (insert `type:'quota'` : verifier le client/cle utilise par le backend et le GRANT/RLS INSERT sur `ziko_ai_credit_transactions` pour ce role ; le test d'integration `creditQuota.integration.test.ts` utilise un ledger en memoire et ne couvre pas la vraie table) |
| Feuille d'epuisement en francais | NON-TESTE | impossible a provoquer tant que le quota ne compte pas ; test de rendu unitaire seulement |
| `GET /forms/athlete/forms/pending` | PASS | 200 `{"forms":[]}` (JWT athlete) |
| Faux Anthropic | PASS | aucun appel reel ; reponses "Reponse simulee du coach IA" |

Note : `GET /credits/balance` renvoie `daily_earned:6` pour `daily_cap:4` (plafond depasse, 4 lignes `earn/audit` de fixture) : incoherence d'affichage possible, non investiguee.
