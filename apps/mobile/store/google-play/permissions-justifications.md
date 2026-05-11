# Permission Declarations — Play Console

À remplir dans **Play Console → Policy → App content → Sensitive app permissions**.

---

## 1. Background Location (`ACCESS_FINE_LOCATION` + `FOREGROUND_SERVICE_LOCATION`)

### Pourquoi l'app utilise la localisation
> Ziko utilise la localisation **uniquement pendant les séances de cardio actives** (course, vélo, Hyrox) que l'utilisateur démarre manuellement, afin d'enregistrer le parcours GPS, calculer la distance, l'allure et le dénivelé en temps réel.

### Foreground service location justification
> La localisation continue en arrière-plan via un foreground service est nécessaire pour que l'enregistrement GPS de la séance de cardio ne s'interrompe pas quand l'utilisateur verrouille son écran ou passe sur une autre app pendant son entraînement (cas d'usage standard pour une séance de course de 30-60 minutes).

### Données GPS
- Stockées localement et sur le compte utilisateur Supabase (RLS activé — accessibles uniquement par le propriétaire)
- **Jamais partagées avec des tiers**
- L'utilisateur peut supprimer ses sessions à tout moment depuis l'app

### Vidéo de démonstration
**Action requise :** enregistrer une courte vidéo (30 sec) montrant :
1. Ouverture de l'écran Cardio
2. Démarrage d'une session ("Démarrer la course")
3. Indicateur live GPS visible (allure, distance qui défilent)
4. Mise en arrière-plan / écran verrouillé → la session continue
5. Retour à l'app → les données s'affichent
→ uploader sur YouTube en non répertorié, fournir le lien à Play Console.

---

## 2. Health Connect permissions

Permissions déclarées :
- `READ_STEPS`, `READ_HEART_RATE`, `READ_SLEEP`, `READ_DISTANCE`
- `READ_TOTAL_CALORIES_BURNED`, `READ_ACTIVE_CALORIES_BURNED`, `READ_EXERCISE`
- `READ_WEIGHT`, `READ_BODY_FAT`
- `WRITE_EXERCISE`, `WRITE_STEPS`

### Justification (à fournir dans la déclaration Health Connect)
> Ziko est une application de fitness qui agrège les données de santé de l'utilisateur pour fournir un coaching personnalisé et un suivi de progression cohérent.
>
> **Lecture** : nous lisons pas, fréquence cardiaque, sommeil, distance, calories, exercices, poids et masse grasse pour les afficher dans le tableau de bord de l'utilisateur, calculer son score de récupération, ajuster son TDEE et donner un contexte précis à son coach IA.
>
> **Écriture** : nous écrivons les séances enregistrées dans Ziko (ExerciseSession) et les pas synthétisés afin que l'écosystème santé de l'utilisateur reste à jour, qu'il quitte ou non Ziko à l'avenir.
>
> Aucune donnée de santé n'est partagée avec un tiers. Les données restent sur l'appareil et sur le compte utilisateur (Supabase, chiffré, RLS activé).

### URL Politique de confidentialité (Health Connect declaration)
`https://ziko.app/privacy` — section "Données de santé" obligatoire dans le doc.

---

## 3. Camera (`expo-camera`)

### Justification
> Ziko utilise la caméra **uniquement pour scanner les codes-barres des aliments** afin de remplir automatiquement les informations nutritionnelles dans le tracker de nutrition. Aucune photo n'est prise, enregistrée ou envoyée à un serveur.

---

## 4. Notifications (`expo-notifications`)

### Usage
- Rappels d'habitudes quotidiennes (configurés par l'utilisateur)
- Rappels d'hydratation (optionnels)
- Aucune notification marketing

---

## Récapitulatif permissions sensibles

| Permission | Sensible ? | Déclaration requise |
|-----------|------------|---------------------|
| ACCESS_FINE_LOCATION | ✅ | Oui — formulaire location |
| FOREGROUND_SERVICE_LOCATION | ✅ | Oui — vidéo demo |
| Health Connect (read/write) | ✅ | Oui — formulaire Health |
| Camera | Non | Justification dans listing suffit |
| Notifications | Non | Auto-déclaré par Expo |
