# Politique de Confidentialité — Ziko

**Dernière mise à jour :** 26 avril 2026

Ziko (« nous », « l'app ») est une application mobile de fitness et coaching IA. Cette politique explique quelles données nous collectons, comment nous les utilisons et tes droits.

---

## 1. Données que nous collectons

### 1.1 Informations de compte
- Adresse email (obligatoire pour la création de compte)
- Nom d'utilisateur (optionnel)
- Mot de passe (haché, jamais lu en clair)

### 1.2 Profil fitness (optionnel)
- Âge, sexe, taille, poids, objectif fitness, niveau d'activité
- Persona / style de coaching IA préféré

### 1.3 Données de santé et fitness
Selon les plugins activés :
- Séances d'entraînement (exercices, séries, charges, RPE)
- Repas et apports nutritionnels (calories, macronutriments)
- Habitudes quotidiennes
- Sommeil (heure de coucher, durée, qualité)
- Mesures corporelles (poids, masse grasse, tours)
- Hydratation
- Journal d'humeur, énergie, stress
- Sessions de cardio avec parcours GPS
- Données Health Connect synchronisées (pas, fréquence cardiaque, sommeil, calories)

### 1.4 Localisation GPS
**Uniquement pendant les séances de cardio actives** que tu démarres manuellement. La localisation n'est jamais collectée en dehors d'une session de cardio explicitement lancée par toi.

### 1.5 Conversations avec le coach IA
Les messages que tu envoies au coach IA et ses réponses sont stockés dans ton compte pour conserver l'historique.

### 1.6 Données techniques
- Logs d'erreur serveur (Supabase, Vercel) — anonymisés
- Aucun pistage publicitaire, aucun ID publicitaire collecté

---

## 2. Comment nous utilisons tes données

- **Fournir le service** : afficher tes séances, calculer ta progression, générer des programmes IA, suivre tes habitudes
- **Personnaliser le coaching IA** : ton coach utilise ton profil et ton historique pour donner des conseils pertinents
- **Communications service** : confirmation d'inscription, réinitialisation de mot de passe (jamais de marketing)

**Nous n'utilisons JAMAIS tes données pour :**
- ❌ Publicité ciblée
- ❌ Vente à des tiers
- ❌ Entraînement de modèles IA (Anthropic applique le zero-retention)
- ❌ Profilage commercial

---

## 3. Partage avec des tiers

Nous partageons tes données uniquement avec les sous-traitants techniques suivants, strictement nécessaires au fonctionnement :

| Sous-traitant | Rôle | Localisation | Politique |
|---------------|------|--------------|-----------|
| Supabase Inc. | Base de données + Auth | EU | https://supabase.com/privacy |
| Vercel Inc. | Hébergement API | US | https://vercel.com/legal/privacy-policy |
| Anthropic PBC | Modèle IA Claude | US | https://www.anthropic.com/legal/privacy |

Les messages envoyés à Anthropic ne sont **pas utilisés pour entraîner leurs modèles** (politique zero-retention API).

---

## 4. Sécurité

- Toutes les données sont chiffrées en transit (HTTPS / TLS)
- Authentification gérée par Supabase Auth
- **Row Level Security (RLS)** activée sur toutes les tables — tu ne peux accéder qu'à TES données
- Mots de passe hachés (bcrypt) — jamais stockés en clair

---

## 5. Tes droits (RGPD)

Tu as le droit de :
- **Accéder** à tes données (export depuis l'app)
- **Rectifier** tes données (modifier ton profil dans l'app)
- **Supprimer** ton compte et toutes tes données :
  - Depuis l'app : Settings → "Supprimer mon compte"
  - Par email : `support@ziko.app`
- **Retirer ton consentement** à tout moment
- **Porter une réclamation** auprès de la CNIL (cnil.fr) si tu es en France

Les données sont supprimées immédiatement de la base de production. Les sauvegardes sont purgées sous 30 jours.

---

## 6. Conservation des données

Tant que ton compte est actif. Si tu n'utilises pas l'app pendant 24 mois, nous t'enverrons un email avant suppression définitive.

---

## 7. Mineurs

Ziko est destinée aux **utilisateurs de 18 ans et plus**. Nous ne collectons pas sciemment de données de mineurs. Si tu penses qu'un mineur a créé un compte, contacte `support@ziko.app`.

---

## 8. Modifications

Nous pouvons mettre à jour cette politique. Les changements significatifs seront notifiés dans l'app. La date "Dernière mise à jour" en haut indique la dernière révision.

---

## 9. Contact

Pour toute question :
- Email : `support@ziko.app`
- Responsable du traitement : [À COMPLÉTER — nom/raison sociale + adresse postale]

---

**Hébergement de cette politique :**
Cette politique doit être accessible publiquement à l'URL `https://ziko.app/privacy` (ou GitHub Pages : `https://anatholyb1.github.io/ziko-platform/privacy`).
