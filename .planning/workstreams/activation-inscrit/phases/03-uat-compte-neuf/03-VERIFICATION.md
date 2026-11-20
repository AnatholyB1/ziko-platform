# Phase 3 - Verification (UATN-01..03)

Detail, preuves et bugs : `03-UAT.md` (meme dossier). Emulateur Android, faux Anthropic, branche Supabase jetable ; iOS reel, vrai Claude, UI d'inscription et OTP non exerces.

| Exigence | Statut | Preuve |
|----------|--------|--------|
| UATN-01 compte neuf -> onboarding -> 1re conversation -> accueil | PASS (ecarts visuels : rangees de la carte cassees, fin d'onboarding sombre) | `.maestro/v121-n01-fresh-account-home.yaml`, `uat-evidence/v121/n01-fresh-account-home/` |
| UATN-02 quetes visibles et completables | PASS | `.maestro/v121-n02-quests.yaml`, `uat-evidence/v121/n02-quests/` |
| UATN-03 les 3 chemins menent a une seance lancee | FAIL : Manuel (programme inactif, aucun retour, carte reste), IA simple (seance vide). Atelier : brouillon -> programme actif -> carte disparue prouves, demarrage de seance NON prouve | `.maestro/v121-n03a-manual.yaml`, `v121-n03b-ai-simple.yaml`, `v121-n03c-atelier.yaml` |
| Credits epuises (FWKO-07) | NON PROUVE | `scripts/uat/v121-exhaust-credits.mjs` ecrit, non execute |

Rappels : le brouillon atelier et la seance IA viennent du faux Anthropic (scripte) ; "Bravo, tout est fait" (3/3 quetes) et le toast de completion n'ont pas ete observes.
