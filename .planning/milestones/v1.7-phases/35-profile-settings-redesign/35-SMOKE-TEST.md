# Phase 35 — Smoke Test

**Status:** PENDING — à faire sur device/simulateur  
**Créé:** 2026-05-22  

---

## 1. Edit Profile (`/(app)/profile/edit`)
- [ ] Tap "Informations personnelles" dans Settings → navigue vers Edit screen (pas d'alerte)
- [ ] Champ Bio sauvegarde correctement — visible après retour au profil
- [ ] Champ Pseudo (handle) sauvegarde correctement — input accepte `@tonpseudo`
- [ ] Nom et Objectif sauvegardent toujours correctement
- [ ] Changement de photo avatar fonctionne toujours (upload + affichage)

## 2. Confidentialité (`/(app)/profile/security`)
- [ ] Toggle "Profil public" charge avec la valeur DB (pas toujours `true`)
- [ ] Toggle off → rouvrir security screen → affiche toujours `off`
- [ ] Toggle on persiste correctement

## 3. Settings (`/(app)/profile/settings`)
- [ ] Badge subscription tier affiche correctement (`Gratuit` ou valeur de la colonne `subscription_tier`)
- [ ] Pas de crash "settings column not found" au chargement

## 4. Onglet Badges (Profil → Badges)
- [ ] Onglet charge sans crash
- [ ] Affiche la vraie liste de badges (pas les fixtures statiques) — 11 badges visibles
- [ ] Badges gagnés en couleur avec emoji ; badges non-gagnés en gris (opacity 0.4)
- [ ] Header affiche le compteur : `X obtenus · Y à débloquer`
- [ ] Si au moins 1 séance effectuée → badge `first_session` gagné

## 5. Photos de progression (Profil → Progrès)
- [ ] Upload photo → pas d'erreur "network failed"

## 6. Régression — éléments existants
- [ ] Onglet Stats du profil charge
- [ ] Hero profil (overlap avatar, compteurs abonnés) s'affiche correctement
- [ ] Toggles Settings (notifications, etc.) sauvegardent toujours

---

**Signal de reprise :** Type `smoke-approved` si tout passe, ou décris ce qui échoue.
