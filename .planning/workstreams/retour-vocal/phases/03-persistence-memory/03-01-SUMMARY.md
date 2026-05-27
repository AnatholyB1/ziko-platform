---
plan: 03-01
status: complete
date: 2026-05-27
---

# Summary: 03-01 — DB Migration + POST /save

## What was done
- Created `supabase/migrations/20260527_coach_vocal_feedbacks.sql`: table avec coach_id, athlete_id, transcript, card(jsonb), created_at. RLS policy: auth.uid() = coach_id (coach-only). Index sur (coach_id, athlete_id, created_at DESC).
- Ajout du handler `POST /voice/save` au `voiceRouter` dans `service.ts`: validation du payload, insert via coach JWT (RLS enforce coach_id), retourne { id }.

## Acceptance
- Migration file avec schema correct, RLS et index ✓
- POST /save handler avec coach_id depuis JWT (pas depuis le body) ✓
- TypeScript compile proprement ✓

## Integration notes
- Plan 03-02: peut désormais requêter coach_vocal_feedbacks dans le handler /structure (vocal_history)
- Plan 03-03: route proxy /api/coach/voice/save prête pour le frontend

## Commits
- `c3a3b9f` feat(03-01): DB migration coach_vocal_feedbacks + POST /voice/save

## Deviations from Plan
None — plan exécuté exactement tel qu'écrit.

## Self-Check: PASSED
- `supabase/migrations/20260527_coach_vocal_feedbacks.sql` existe ✓
- `voiceRouter.post('/save', ...)` présent dans service.ts ✓
- `grep -c "coach_vocal_feedbacks" migration` retourne 6 (≥3) ✓
- TypeScript: aucune erreur ✓
