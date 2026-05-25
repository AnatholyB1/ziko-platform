# Requirements — v1.11 Notification System
**Workstream:** notification-mobile  
**Milestone:** v1.11 Notification System  
**Created:** 2026-05-25  

---

## v1.11 Requirements

### Infrastructure & Configuration

- [ ] **INFRA-01:** Les packages `expo-notifications`, l'entitlement `aps-environment` iOS, la permission `POST_NOTIFICATIONS` Android et le plugin `expo-notifications` sont ajoutés à `app.json` avant tout build EAS
- [ ] **INFRA-02:** Une migration Supabase `022_notification_schema.sql` crée les tables `notification_tokens`, `notification_log` et `notification_preferences` avec RLS et politique ON DELETE CASCADE sur suppression compte
- [ ] **INFRA-03:** Un service `notificationService.ts` dans Hono gère l'envoi push : vérification des préférences, fetch des tokens actifs, chunking ≤100, idempotency via `UNIQUE(idempotency_key)`, écriture dans `notification_log`
- [ ] **INFRA-04:** Un EAS Development Build (profil `development`) est disponible pour tester les push sur device réel (Expo Go ne supporte plus les push en SDK 54)

### Token Registration & Permission

- [ ] **TOKEN-01:** L'utilisateur voit un écran custom pre-permission (valeur + exemples de notifications) avant le prompt natif OS — le prompt natif n'est jamais affiché à froid
- [ ] **TOKEN-02:** Le token push de l'utilisateur est enregistré automatiquement au démarrage via `useNotificationSetup` hook et stocké dans `notification_tokens` (UPSERT par `(user_id, device_id)`)
- [ ] **TOKEN-03:** La rotation automatique de token est gérée via `addPushTokenListener` — re-registration transparente sans action utilisateur
- [ ] **TOKEN-04:** Si la permission est refusée (`canAskAgain = false`), le hook ne re-prompt pas — l'écran Paramètres propose un lien vers les réglages système

### Action-triggered Push Notifications

- [ ] **PUSH-01:** L'utilisateur reçoit un push quand son coach lui assigne un programme
- [ ] **PUSH-02:** L'utilisateur reçoit un push quand une invitation coach est acceptée (les deux sens : athlète ← invitation acceptée, coach ← athlète a rejoint)
- [ ] **PUSH-03:** L'utilisateur reçoit un push résumé de sa séance ~2 minutes après la fin d'un `workout_sessions` (le push est supprimé si une session active est encore en cours)
- [ ] **PUSH-04:** L'utilisateur reçoit un push quand il monte de niveau ou débloque un badge — plusieurs évènements dans la même session sont collapsés en une seule notification

### Cron / Scheduled Notifications

- [ ] **CRON-01:** Un cron quotidien à 21h UTC détecte les streaks d'habitudes à risque (streak ≥ 3 jours, habitude non validée ce jour) et envoie un push par utilisateur concerné
- [ ] **CRON-02:** Un cron toutes les 15 minutes traite les receipts Expo Push API et désactive (`is_active = false`) les tokens `DeviceNotRegistered`
- [ ] **CRON-03:** Un cron hebdomadaire (dimanche 9h UTC) envoie un digest de la semaine (séances, XP, streak) — opt-in seulement (désactivé par défaut)

### In-app Notification Center

- [ ] **CENTER-01:** Le centre de notifications (`notifications.tsx`) affiche les données réelles depuis `notification_log` via TanStack Query (remplace les données mock `INITIAL_ITEMS`)
- [ ] **CENTER-02:** L'utilisateur peut marquer une notification comme lue (tap) et marquer toutes comme lues — `read_at` mis à jour dans Supabase
- [ ] **CENTER-03:** Le badge de l'icône app et le compteur dans le header reflètent le nombre de notifications non lues (`setBadgeCountAsync`)
- [ ] **CENTER-04:** Taper sur une notification navigue vers l'écran concerné via deep link (`data.url` → Expo Router path)
- [ ] **CENTER-05:** Le centre de notifications se met à jour en temps réel via Supabase Realtime (subscription sur `notification_log` filtrée par `user_id`)

### Notification Preferences

- [ ] **PREF-01:** L'utilisateur peut activer/désactiver toutes les push notifications via un master switch dans Paramètres > Notifications
- [ ] **PREF-02:** L'utilisateur peut configurer les notifications par catégorie : Coach, Workout, Gamification, Santé & Habitudes, App (toggles indépendants)
- [ ] **PREF-03:** L'utilisateur peut définir un créneau silencieux (quiet hours) avec heure de début et heure de fin — les pushs server-side respectent ce créneau
- [ ] **PREF-04:** Les préférences sont sauvegardées automatiquement dans `notification_preferences` (pas de bouton Save)

### Local Reminders

- [ ] **LOCAL-01:** L'utilisateur peut configurer un rappel quotidien pour chaque habitude (heure choisie dans l'interface habitude) — planifié via `scheduleNotificationAsync`
- [ ] **LOCAL-02:** L'utilisateur peut activer des rappels les jours d'entraînement programmés (selon son programme coach ou son plan personnel)
- [ ] **LOCAL-03:** Les rappels locaux sont annulés/replaniés automatiquement quand les préférences ou le programme changent

### App Update Notifications

- [ ] **APP-01:** Les notifications de mise à jour OTA de l'app apparaissent dans le centre de notifications in-app sous la catégorie "App" — pas de push natif pour les updates

---

## Future Requirements (deferred)

- Push natif pour les mises à jour app (push natif = friction inutile pour OTA)
- Snooze action sur les rappels workout (bouton action iOS/Android) — v1.12+
- Notification marketing / upsell push — interdit en v1.11, in-app banners seulement
- Support IANA timezone pour quiet hours (v1 = UTC offset entier, acceptable)
- Supabase Realtime en WebSocket pour badge live — inclus en v1.11 (CENTER-05)

## Out of Scope

- Notifications par email ou SMS — push mobile uniquement
- Firebase Admin SDK direct — Expo Push Service uniquement (`expo-server-sdk`)
- Segmentation / A/B test de push — pas de tiers marketing (pas de OneSignal, Braze)
- Dark mode pour l'écran de préférences — light sport theme uniquement

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| TOKEN-01 | Phase 1 | Pending |
| TOKEN-02 | Phase 1 | Pending |
| TOKEN-03 | Phase 1 | Pending |
| TOKEN-04 | Phase 1 | Pending |
| PUSH-01 | Phase 2 | Pending |
| PUSH-02 | Phase 2 | Pending |
| PUSH-03 | Phase 2 | Pending |
| PUSH-04 | Phase 2 | Pending |
| CENTER-01 | Phase 3 | Pending |
| CENTER-02 | Phase 3 | Pending |
| CENTER-03 | Phase 3 | Pending |
| CENTER-04 | Phase 3 | Pending |
| CENTER-05 | Phase 3 | Pending |
| CRON-01 | Phase 4 | Pending |
| CRON-02 | Phase 4 | Pending |
| CRON-03 | Phase 4 | Pending |
| PREF-01 | Phase 5 | Pending |
| PREF-02 | Phase 5 | Pending |
| PREF-03 | Phase 5 | Pending |
| PREF-04 | Phase 5 | Pending |
| LOCAL-01 | Phase 6 | Pending |
| LOCAL-02 | Phase 6 | Pending |
| LOCAL-03 | Phase 6 | Pending |
| APP-01 | Phase 6 | Pending |
