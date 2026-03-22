# Ziko Platform — Routes & AI Tools Reference

Use this skill when working on the Ziko fitness app to understand all available routes, AI tools, and plugin capabilities.

---

## Base App Routes (Mobile — Expo Router v4)

### Main App (`/(app)/`)

| Route | Screen | Description |
|-------|--------|-------------|
| `/(app)/` | Home Dashboard | Daily overview: workout programs, nutrition summary, habits progress, wellness section (sleep, hydration, journal, measurements), plugin grid |
| `/(app)/workout/index` | Programs | List of workout programs (user-created + AI-generated) |
| `/(app)/workout/[id]` | Program Detail | View program exercises, sets, reps. Start session button |
| `/(app)/workout/session` | Active Workout | Guided session with exercise tracking, timer, set logging |
| `/(app)/workout/history` | Workout History | Past sessions with volume, duration, date |
| `/(app)/ai/index` | AI Chat | Streaming chat with Ziko AI coach. Supports tool calls |
| `/(app)/profile/index` | Profile | User profile: name, weight, height, goal, units, avatar |
| `/(app)/profile/settings` | Settings | App settings: language, theme, notifications, account management |
| `/(app)/store/index` | Plugin Store | Browse installable plugins by category with ratings |
| `/(app)/store/[id]` | Plugin Detail | Plugin description, screenshots, install/uninstall, reviews |

### Auth Routes (`/(auth)/`)

| Route | Screen | Description |
|-------|--------|-------------|
| `/(auth)/login` | Login | Email/password + social login (Apple, Google) |
| `/(auth)/register` | Register | Create account with email/password |
| `/(auth)/onboarding/step-1` | Name & Age | User enters name and date of birth |
| `/(auth)/onboarding/step-2` | Body Metrics | Weight (kg/lbs), height (cm/ft), gender |
| `/(auth)/onboarding/step-3` | Fitness Goal | muscle_gain, fat_loss, strength, endurance, general_fitness |
| `/(auth)/onboarding/step-4` | Experience Level | beginner, intermediate, advanced |
| `/(auth)/onboarding/step-5` | Plugin Selection | Choose starter plugins to install |

---

## Plugin Routes (14 plugins)

### Habits (`habits`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/habits/dashboard` | Yes | Today's habits with completion status, streaks, cross-plugin cards (nutrition, hydration, sleep) |
| `/(plugins)/habits/log` | No | Create new habit (name, emoji, type, target, unit) |

### Nutrition (`nutrition`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/nutrition/dashboard` | Yes | Daily macros (calories, protein, carbs, fat), meal log, goals |
| `/(plugins)/nutrition/log` | No | Log a meal with food name, macros, meal type |

### AI Persona (`persona`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/persona/customize` | Yes | Customize AI coaching personality, tone, language |

### Analytics (`stats`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/stats/dashboard` | Yes | Workout analytics: volume trends, frequency, muscle group distribution |

### Gamification (`gamification`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/gamification/dashboard` | Yes | XP, level, coins, daily challenges |
| `/(plugins)/gamification/shop` | No | Buy rewards (themes, banners) with coins |

### Community (`community`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/community/dashboard` | Yes | Friends, leaderboards, group challenges |
| `/(plugins)/community/chat` | No | Direct messaging between friends |
| `/(plugins)/community/challenge` | No | Create/join fitness challenges |

### Stretching (`stretching`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/stretching/dashboard` | Yes | Stretching routines library (pre/post workout, recovery) |
| `/(plugins)/stretching/session` | No | Guided stretching session with timer |

### Sleep (`sleep`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/sleep/dashboard` | Yes | Sleep history, quality chart, average duration, recovery score |
| `/(plugins)/sleep/log` | No | Log bedtime, wake time, quality (1-5), notes |

### Measurements (`measurements`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/measurements/dashboard` | Yes | Body measurement history, weight chart, progress photos |
| `/(plugins)/measurements/log` | No | Log weight, body fat, circumferences (waist, chest, arm, etc.) |

### Timer (`timer`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/timer/dashboard` | Yes | Timer presets (Tabata, HIIT, EMOM), custom timers, active timer |

### AI Programs (`ai-programs`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/ai-programs/dashboard` | Yes | AI-generated program list, active program |
| `/(plugins)/ai-programs/generate` | No | Generate new program: goal, split, days/week, equipment |

### Journal (`journal`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/journal/dashboard` | Yes | Mood, energy, stress trends. Daily entries list |
| `/(plugins)/journal/entry` | No | New journal entry: mood, energy, stress (1-5), context, notes |

### Hydration (`hydration`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/hydration/dashboard` | Yes | Daily water intake vs goal, glass counter, history |

### Cardio (`cardio`)
| Route | Tab | Description |
|-------|-----|-------------|
| `/(plugins)/cardio/dashboard` | Yes | Cardio session history, stats, pace trends |
| `/(plugins)/cardio/log` | No | Log session: activity type, duration, distance, calories, heart rate |

---

## Backend API Routes (Hono — `/api`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/ai/tools` | Yes | List all 34 registered AI tool schemas |
| POST | `/ai/tools/execute` | Yes | Execute a single tool: `{ tool_name, parameters }` |
| POST | `/ai/chat/stream` | Yes | Streaming SSE chat: `{ messages, conversation_id? }` |
| POST | `/ai/chat` | Yes | Non-streaming chat: `{ messages, conversation_id? }` |
| POST | `/ai/vision/nutrition` | Yes | Analyze food photo: `{ image (base64), meal_context? }` |
| GET | `/plugins` | Yes | List plugin registry |
| POST | `/webhooks` | No | Supabase webhook handlers |

---

## AI Tools (34 total — all registered in backend)

### Habits (4 tools)
- `habits_get_today` — Get active habits + today's completion status
- `habits_log` — Mark habit done / update count value
- `habits_get_streaks` — Get streak (consecutive days) per habit
- `habits_create` — Create a new habit

### Nutrition (4 tools)
- `nutrition_get_today` — Get all meals logged today with macros
- `nutrition_log_meal` — Log a food entry (requires meal_type, food_name, calories)
- `nutrition_get_summary` — Today's macro summary vs estimated goals
- `nutrition_delete_entry` — Delete a nutrition log entry by ID

### Stretching (3 tools)
- `stretching_get_routines` — Get routines filtered by type/muscle group
- `stretching_log_session` — Log a stretching session (duration_seconds)
- `stretching_get_history` — Recent stretching history (days param)

### Sleep (3 tools)
- `sleep_log` — Log sleep entry (bedtime, wake_time, quality 1-5)
- `sleep_get_history` — Get sleep logs for recent days
- `sleep_get_recovery_score` — Today's recovery score (sleep + training load)

### Measurements (3 tools)
- `measurements_log` — Log body measurements (weight, body fat, circumferences)
- `measurements_get_history` — Get measurement history (days param)
- `measurements_get_progress` — Compare current vs N days ago

### Timer (2 tools)
- `timer_get_presets` — Get user + default timer presets
- `timer_create_preset` — Create custom timer (name, type, work/rest/rounds)

### AI Programs (3 tools)
- `ai_programs_generate` — Generate personalized workout program via AI
- `ai_programs_list` — List all AI-generated programs
- `ai_programs_adjust` — Adjust program difficulty (easier/harder/volume)

### Journal (3 tools)
- `journal_log_mood` — Log mood, energy, stress (1-5)
- `journal_get_history` — Get journal entries (days param)
- `journal_get_trends` — Get mood/energy/stress averages over time

### Hydration (3 tools)
- `hydration_log` — Log water intake (amount_ml)
- `hydration_get_today` — Get today's total intake + goal
- `hydration_set_goal` — Set daily water goal in ml

### Cardio (3 tools)
- `cardio_log_session` — Log cardio session (activity, duration, distance)
- `cardio_get_history` — Get cardio history (days, optional activity filter)
- `cardio_get_stats` — Aggregate stats (total distance, time, avg pace)

---

## AI Skills (23 total — trigger-based context injection)

| Plugin | Skill | Trigger Keywords |
|--------|-------|------------------|
| Habits | habit_analysis | habit, habitude, routine, streak, consistency |
| Habits | habit_coaching | goals, objectifs, discipline, motivation |
| Nutrition | meal_planning | repas, meal, plan, menu, recette |
| Nutrition | calorie_feedback | calorie, kcal, macro, protéine |
| Nutrition | nutrition_coaching | nutrition, alimentation, régime, diet |
| Stretching | stretching_recommendation | stretch, étirement, mobilité, warm up |
| Stretching | stretching_coaching | raideur, stiffness, tension, foam roll |
| Sleep | sleep_analysis | sommeil, sleep, dormir, insomnie, fatigué |
| Sleep | recovery_coaching | récupérer, recover, surentraînement, rest day |
| Measurements | body_progress | poids, weight, mensurations, body fat |
| Timer | timer_recommendation | timer, minuteur, HIIT, tabata, EMOM |
| AI Programs | program_generation | programme, program, plan, routine, split |
| AI Programs | program_adaptation | adapter, progression, plateau, modifier |
| Journal | mood_analysis | humeur, mood, énergie, stress, mental |
| Journal | mindset_coaching | démotivé, abandonner, confiance, mindset |
| Hydration | hydration_tracking | eau, water, hydratation, boire, verre |
| Cardio | cardio_analysis | cardio, course, running, vélo, pace |
| Cardio | running_coaching | plan course, marathon, 5k, 10k, fractionné |
| Stats | full_analytics | statistiques, analytics, analyse, progression |
| Gamification | gamification_info | XP, niveau, level, coins, récompense |
| Community | community_info | amis, friends, défi, challenge, classement |
| Persona | — | (no skills, no tools — only persona customization) |

---

## Database Tables Reference

| Table | Plugin | Key Columns |
|-------|--------|-------------|
| `habits` | habits | name, emoji, type (boolean/count), target, source, is_active |
| `habit_logs` | habits | habit_id, date, value (unique per habit+date) |
| `nutrition_logs` | nutrition | date, meal_type, food_name, calories, protein_g, carbs_g, fat_g |
| `stretching_logs` | stretching | routine_name, duration_sec, exercises (JSONB), date |
| `sleep_logs` | sleep | bedtime, wake_time, duration_hours, quality 1-5 (unique user+date) |
| `body_measurements` | measurements | weight_kg, body_fat_pct, waist/chest/arm/thigh/hip_cm, date |
| `timer_presets` | timer | name, type, work_sec, rest_sec, rounds |
| `ai_generated_programs` | ai-programs | name, goal, split_type, days_per_week, program_data (JSONB) |
| `journal_entries` | journal | mood/energy/stress 1-5, context, notes, date |
| `hydration_logs` | hydration | amount_ml, date |
| `cardio_sessions` | cardio | activity_type, duration_min, distance_km, calories_burned, avg_pace |
