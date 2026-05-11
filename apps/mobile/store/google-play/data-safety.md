# Data Safety Form — Play Console

À remplir dans **Play Console → Policy → App content → Data safety**.

---

## Section 1 — Data collection and security

### Does your app collect or share any of the required user data types?
**✅ Yes**

### Is all of the user data collected by your app encrypted in transit?
**✅ Yes** (HTTPS via Supabase + Vercel)

### Do you provide a way for users to request that their data is deleted?
**✅ Yes** — l'utilisateur peut supprimer son compte depuis Settings → "Supprimer mon compte" (ou demande email à `support@ziko.app`).

---

## Section 2 — Data types collected

### Personal info
| Data type | Collected | Shared | Required/Optional | Purpose |
|-----------|-----------|--------|-------------------|---------|
| Name | ✅ | ❌ | Optional | Account management, app functionality |
| Email address | ✅ | ❌ | Required | Account management, communications |
| User IDs | ✅ | ❌ | Required | Account management |

### Health and fitness
| Data type | Collected | Shared | Required/Optional | Purpose |
|-----------|-----------|--------|-------------------|---------|
| Health info (poids, masse grasse, fréquence cardiaque, sommeil) | ✅ | ❌ | Optional | App functionality, personalization |
| Fitness info (workouts, steps, calories) | ✅ | ❌ | Optional | App functionality, personalization |

### Location
| Data type | Collected | Shared | Required/Optional | Purpose |
|-----------|-----------|--------|-------------------|---------|
| Approximate location | ❌ | ❌ | — | — |
| Precise location (GPS cardio) | ✅ | ❌ | Optional | App functionality |

→ Note : collecté **uniquement pendant une session de cardio active**, jamais en arrière-plan sans intention utilisateur.

### Personal info — Other
| Data type | Collected | Shared | Required/Optional | Purpose |
|-----------|-----------|--------|-------------------|---------|
| Other info (âge, taille, objectif fitness, persona IA) | ✅ | ❌ | Optional | Personalization |

### Messages
| Data type | Collected | Shared | Required/Optional | Purpose |
|-----------|-----------|--------|-------------------|---------|
| Other in-app messages (conversations avec coach IA) | ✅ | ✅ (Anthropic) | Optional | App functionality |

→ Note : les messages sont envoyés à l'API Anthropic (Claude) **uniquement pour générer la réponse IA**, ne sont pas utilisés pour entraîner les modèles (zero-retention).

### Photos and videos
- ❌ Pas de collecte (la caméra ne sert qu'au scan barcode, aucune image stockée)

### Audio files
- ❌ Pas de collecte

### Files and docs
- ❌ Pas de collecte

### Calendar
- ❌ Pas de collecte

### Contacts
- ❌ Pas de collecte

### App activity
| Data type | Collected | Shared | Required/Optional | Purpose |
|-----------|-----------|--------|-------------------|---------|
| App interactions (séances loggées, habitudes cochées) | ✅ | ❌ | Required | App functionality |

### Web browsing
- ❌ Pas de collecte

### App info and performance
- ❌ Pas de crash logs tiers (sauf logs Supabase/Vercel internes)

### Device or other IDs
- ❌ Pas de collecte d'IDs publicitaires

---

## Section 3 — Security practices

| Practice | Yes/No |
|----------|--------|
| Data is encrypted in transit | ✅ Yes |
| You provide a way for users to request that their data is deleted | ✅ Yes |
| Committed to follow Play Families Policy | ❌ N/A (app pour adultes 18+) |
| Independent security review | ❌ No |

---

## Section 4 — Data deletion

### How users can request data deletion
> L'utilisateur peut supprimer son compte et toutes ses données associées :
> 1. Depuis l'app : Settings → "Supprimer mon compte" (action immédiate)
> 2. Par email : `support@ziko.app` (réponse sous 7 jours)
>
> Toutes les données (profil, séances, nutrition, mesures, conversations IA) sont supprimées de Supabase. Les sauvegardes Supabase sont purgées sous 30 jours.

### Account deletion URL
`https://ziko.app/delete-account` (page web à créer — cf. checklist).

---

## Récapitulatif partenaires tiers

| Service | Type de données | Pays | Lien |
|---------|----------------|------|------|
| Supabase | Toutes données app (chiffré, RLS) | EU | https://supabase.com/privacy |
| Vercel | Logs serveur API | US | https://vercel.com/legal/privacy-policy |
| Anthropic | Messages IA uniquement | US | https://www.anthropic.com/legal/privacy |

