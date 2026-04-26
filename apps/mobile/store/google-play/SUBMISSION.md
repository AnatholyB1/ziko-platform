# Google Play Submission — Ziko

Checklist pour soumission en **internal testing** (puis promotion ultérieure vers production).

> **État actuel** : `com.ziko.mobile` créé sur Play Console, release `beta-0.1.0` déjà présente sur le track internal. EAS Submit est donc opérationnel directement.

---

## ⚙️ Pré-requis techniques

- [x] `eas.json` configuré avec `submit.production.android` (track **internal**, releaseStatus completed)
- [x] `app.json` package = `com.ziko.mobile`, versionCode auto-incrémenté
- [x] `.gitignore` exclut `google-service-account.json`
- [ ] **Service account JSON placé à `apps/mobile/google-service-account.json`** (NE PAS committer)
- [x] App créée dans Play Console avec package `com.ziko.mobile`
- [ ] Service account ajouté comme utilisateur du Play Console (rôle "Release manager" ou "Admin")
- [x] Première release brouillon (`beta-0.1.0`) déjà présente sur internal

---

## 🚀 Soumission internal — flow simple

Pour pousser une nouvelle build sur le track internal :

```bash
cd apps/mobile

# 1. Build AAB de production (signé EAS)
eas build --platform android --profile production

# 2. Submit automatique sur internal testing
eas submit --platform android --profile production
```

**Important pour internal testing :**
- ✅ Pas de review Google nécessaire — disponible aux testeurs immédiatement
- ✅ Pas besoin de remplir Data Safety / Content Rating / Privacy Policy pour pousser sur internal
- ✅ Jusqu'à 100 testeurs (liste email gérée dans Play Console → Testing → Internal testing → Testers)
- ⚠️ Les testeurs doivent rejoindre via le lien d'opt-in fourni par Play Console

---

## 📝 Track internal — testeurs

À configurer une fois dans **Play Console → Testing → Internal testing** :

- [ ] Créer une mailing list de testeurs (max 100 emails Google)
- [ ] Récupérer le lien d'opt-in (`https://play.google.com/apps/internaltest/...`)
- [ ] Partager le lien aux testeurs (ils l'ouvrent, acceptent, puis téléchargent depuis le Play Store comme une app normale)

Champs de release internal (**Play Console → Internal testing → Create new release**) :
- [ ] **Release name** : auto = `versionCode (versionName)` — laisser par défaut
- [ ] **Release notes** : court changelog en FR + EN (cf. template ci-dessous)

Template release notes :
```
<fr-FR>
- Première version interne de Ziko
- Coach IA, suivi entraînement, nutrition, cardio GPS, sommeil, mesures
- 17 plugins activables
</fr-FR>

<en-US>
- First Ziko internal release
- AI coach, workout tracking, nutrition, GPS cardio, sleep, measurements
- 17 enable-on-demand plugins
</en-US>
```

---

## 📋 Pour graduer vers production (plus tard)

Quand tu seras prêt à passer de internal → production, il faudra **alors seulement** :

1. Changer dans `eas.json` : `"track": "production"` + `"releaseStatus": "draft"`
2. Compléter le **Main store listing** → cf. `listings.md`
3. Compléter **Data safety** → cf. `data-safety.md`
4. Compléter **Content rating** (questionnaire IARC)
5. Déclarer les **Sensitive permissions** (Location background + Health Connect) → cf. `permissions-justifications.md`
6. Héberger la **Politique de confidentialité** publiquement → cf. `privacy-policy.md`
7. Créer une **page de suppression de compte** publique
8. Préparer **assets graphiques** (icon 512×512, feature graphic 1024×500, screenshots ×6)
9. Tourner la **vidéo demo background location** (obligatoire pour la review)
10. Si compte développeur perso post-nov 2023 : faire 14 jours de **closed testing** avec ≥12 testeurs

Tous ces éléments sont préparés dans ce dossier — il ne restera qu'à coller dans Play Console.

---

## 📂 Fichiers de ce dossier

| Fichier | Usage | Quand |
|---------|-------|-------|
| `SUBMISSION.md` | Cette checklist | Maintenant |
| `listings.md` | Textes store FR + EN | Promotion → production |
| `permissions-justifications.md` | Déclarations permissions sensibles | Promotion → production |
| `data-safety.md` | Réponses Data Safety form | Promotion → production |
| `privacy-policy.md` | Politique à héberger | Promotion → production |

---

## 📋 À remplir par toi avant promotion en production

| Info | Valeur |
|------|--------|
| Nom développeur (Play Console) | ? |
| Adresse postale développeur | ? |
| Email contact public | ? |
| Site web | ? |
| URL politique de confidentialité hébergée | ? |
| URL page suppression de compte | ? |
| Lien vidéo demo background location | ? |
| User demo pour Google review | ? |
