-- ============================================================
-- ZIKO PLATFORM — Seed Data
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- DEFAULT EXERCISES LIBRARY
-- ============================================================

INSERT INTO public.exercises (name, category, muscle_groups, instructions, is_custom) VALUES

-- CHEST
('Bench Press', 'strength', ARRAY['chest','triceps','shoulders'],
 'Lie flat on bench. Grip bar slightly wider than shoulders. Lower bar to chest, press up explosively.', FALSE),
('Incline Dumbbell Press', 'strength', ARRAY['chest','triceps','shoulders'],
 'Set bench to 30-45°. Press dumbbells from shoulder level to full extension above chest.', FALSE),
('Push-Up', 'strength', ARRAY['chest','triceps','shoulders'],
 'Start in plank position. Lower chest to floor, keeping core tight. Push back up.', FALSE),
('Cable Fly', 'strength', ARRAY['chest'],
 'Stand between cables. With slight elbow bend, bring handles together in front of chest.', FALSE),
('Dips', 'strength', ARRAY['chest','triceps'],
 'Grip parallel bars. Lower until elbows at 90°, lean slightly forward to target chest.', FALSE),

-- BACK
('Pull-Up', 'strength', ARRAY['back','biceps'],
 'Hang from bar with overhand grip. Pull until chin above bar, lower with control.', FALSE),
('Barbell Row', 'strength', ARRAY['back','biceps'],
 'Hinge at hips, grip bar. Pull to lower chest keeping back flat, lower with control.', FALSE),
('Lat Pulldown', 'strength', ARRAY['back','biceps'],
 'Sit at machine, grip bar wide. Pull down to upper chest, squeeze lats at bottom.', FALSE),
('Seated Cable Row', 'strength', ARRAY['back','biceps'],
 'Sit tall, pull handle to lower sternum, squeeze shoulder blades together.', FALSE),
('Deadlift', 'strength', ARRAY['back','glutes','hamstrings','traps'],
 'Stand hip-width, grip bar. Keep back flat, drive hips forward to stand, lower with control.', FALSE),

-- LEGS
('Back Squat', 'strength', ARRAY['quads','glutes','hamstrings'],
 'Bar on upper back, feet shoulder-width. Squat until thighs parallel to floor.', FALSE),
('Romanian Deadlift', 'strength', ARRAY['hamstrings','glutes'],
 'Hip hinge movement. Keep legs nearly straight, lower bar along legs to mid-shin.', FALSE),
('Leg Press', 'strength', ARRAY['quads','glutes'],
 'Press platform away from body. Do not lock knees at top.', FALSE),
('Walking Lunge', 'strength', ARRAY['quads','glutes','hamstrings'],
 'Step forward, lower back knee toward floor, alternate legs walking forward.', FALSE),
('Leg Extension', 'strength', ARRAY['quads'],
 'Sit at machine, extend legs fully, lower with control.', FALSE),
('Leg Curl', 'strength', ARRAY['hamstrings'],
 'Lie face down, curl weight toward glutes, lower with control.', FALSE),
('Calf Raise', 'strength', ARRAY['calves'],
 'Stand on edge of step, raise heels as high as possible, lower below step level.', FALSE),

-- SHOULDERS
('Overhead Press', 'strength', ARRAY['shoulders','triceps'],
 'Press bar or dumbbells from shoulder height to full extension overhead.', FALSE),
('Lateral Raise', 'strength', ARRAY['shoulders'],
 'Raise dumbbells to side until parallel to floor, lower with control.', FALSE),
('Face Pull', 'strength', ARRAY['shoulders','traps','rear_delts'],
 'Pull cable to face level, flare elbows out to develop rear delts.', FALSE),
('Arnold Press', 'strength', ARRAY['shoulders','triceps'],
 'Start with palms facing you, rotate outward as you press to full extension.', FALSE),

-- ARMS
('Barbell Curl', 'strength', ARRAY['biceps'],
 'Curl bar from extended to fully contracted, lower with control. No swinging.', FALSE),
('Incline Dumbbell Curl', 'strength', ARRAY['biceps'],
 'Sit on incline bench, curl dumbbells for full range of motion.', FALSE),
('Hammer Curl', 'strength', ARRAY['biceps','forearms'],
 'Neutral grip curl. Targets brachialis and brachioradialis.', FALSE),
('Tricep Pushdown', 'strength', ARRAY['triceps'],
 'Push cable attachment down until arms fully extended, return slowly.', FALSE),
('Skull Crusher', 'strength', ARRAY['triceps'],
 'Lower bar to forehead from extended position above head.', FALSE),
('Close-Grip Bench Press', 'strength', ARRAY['triceps','chest'],
 'Grip bar at shoulder width, press for tricep focus.', FALSE),

-- CORE
('Plank', 'strength', ARRAY['core','abs'],
 'Hold push-up position with forearms on floor. Keep body in straight line.', FALSE),
('Cable Crunch', 'strength', ARRAY['abs'],
 'Kneel at cable, crunch down to bring elbows toward knees.', FALSE),
('Hanging Leg Raise', 'strength', ARRAY['abs','hip_flexors'],
 'Hang from bar, raise legs until parallel to floor.', FALSE),
('Ab Wheel Rollout', 'strength', ARRAY['abs','core'],
 'Roll wheel from kneeling position as far as possible, return under control.', FALSE),

-- CARDIO
('Running', 'cardio', ARRAY['full_body','cardiovascular'],
 'Maintain comfortable pace, land midfoot. Arms at 90°.', FALSE),
('Cycling', 'cardio', ARRAY['quads','calves','cardiovascular'],
 'Adjust seat height so slight knee bend at bottom. Maintain cadence.', FALSE),
('Rowing Machine', 'cardio', ARRAY['back','legs','cardiovascular'],
 'Drive with legs first, then lean back, then pull handle to sternum.', FALSE),
('Jump Rope', 'cardio', ARRAY['calves','cardiovascular'],
 'Land on balls of feet, minimal jump height. Wrists do the work.', FALSE),
('Burpee', 'cardio', ARRAY['full_body','cardiovascular'],
 'Squat down, jump feet back to plank, push-up, jump feet to hands, jump up.', FALSE);

-- ============================================================
-- PLUGINS REGISTRY (built-in plugins)
-- ============================================================

INSERT INTO public.plugins_registry (plugin_id, manifest, bundle_url, is_active, version)
VALUES
(
  'nutrition',
  '{
    "id": "nutrition",
    "name": "Nutrition Tracker",
    "version": "1.0.0",
    "description": "Track your daily nutrition: log meals, monitor macros, and get AI-powered dietary advice tailored to your fitness goals.",
    "icon": "restaurant",
    "category": "nutrition",
    "price": "free",
    "requiredPermissions": ["read_profile", "read_workout_history"],
    "userDataKeys": ["nutrition"],
    "aiSkills": [
      {"name": "meal_planning", "description": "Propose personalised meal plans based on goal", "triggerKeywords": ["meal plan","what to eat","diet","repas","nutrition"]},
      {"name": "calorie_feedback", "description": "Comment on logged meals and daily totals", "triggerKeywords": ["calories","did I eat","my intake","macros"]},
      {"name": "nutrition_coaching", "description": "Answer nutrition questions using user context", "triggerKeywords": ["protein","carbs","fat","lose weight","gain muscle","food"]}
    ],
    "routes": [
      {"path": "/(plugins)/nutrition/log", "title": "Log Meal", "icon": "fork-knife", "showInTabBar": false},
      {"path": "/(plugins)/nutrition/dashboard", "title": "Nutrition", "icon": "leaf", "showInTabBar": true}
    ]
  }'::jsonb,
  NULL,
  TRUE,
  '1.0.0'
),
(
  'persona',
  '{
    "id": "persona",
    "name": "AI Persona & Habits",
    "version": "1.0.0",
    "description": "Customise your AI coach: give it a name, personality traits, unique habits, and a backstory to make it truly yours.",
    "icon": "persona-icon",
    "category": "persona",
    "price": "free",
    "requiredPermissions": ["read_profile"],
    "userDataKeys": ["persona"],
    "aiSkills": [],
    "routes": [
      {"path": "/(plugins)/persona/customize", "title": "AI Persona", "icon": "user-circle", "showInTabBar": true}
    ]
  }'::jsonb,
  NULL,
  TRUE,
  '1.0.0'
),
(
  'habits',
  '{
    "id": "habits",
    "name": "Daily Habits & Goals",
    "version": "1.0.0",
    "description": "Track your daily goals: water, workouts, sleep, nutrition and custom habits. Smart reminders and streaks — fully connected to your AI coach, workout history and nutrition plugin.",
    "icon": "checkmark-circle-outline",
    "category": "coaching",
    "price": "free",
    "requiredPermissions": ["read_profile", "read_workout_history", "read_nutrition", "notifications"],
    "userDataKeys": ["habits"],
    "aiSkills": [
      {"name": "habit_analysis", "description": "Analyse habit streaks and completion rate", "triggerKeywords": ["habit","streak","routine","daily goal","habitude","objectif"]},
      {"name": "habit_coaching", "description": "Advice on building good habits", "triggerKeywords": ["build habit","consistency","motivation","tracking","routine"]}
    ],
    "routes": [
      {"path": "/(plugins)/habits/dashboard", "title": "Habits", "icon": "checkmark-circle-outline", "showInTabBar": true},
      {"path": "/(plugins)/habits/log", "title": "Add Habit", "icon": "add-circle-outline", "showInTabBar": false}
    ]
  }'::jsonb,
  NULL,
  TRUE,
  '1.0.0'
);

-- ============================================================
-- SAMPLE FOOD DATABASE (common foods)
-- ============================================================

INSERT INTO public.food_database (name, brand, calories, protein_g, carbs_g, fat_g, fiber_g, serving_g) VALUES
('Chicken Breast (cooked)', NULL, 165, 31, 0, 3.6, 0, 100),
('Brown Rice (cooked)', NULL, 112, 2.6, 23.5, 0.9, 1.8, 100),
('Whole Egg', NULL, 155, 13, 1.1, 11, 0, 100),
('Oats (dry)', NULL, 389, 17, 66, 7, 10.6, 100),
('Greek Yogurt (0% fat)', NULL, 59, 10, 3.6, 0.4, 0, 100),
('Salmon (cooked)', NULL, 208, 28, 0, 10, 0, 100),
('Sweet Potato (baked)', NULL, 90, 2, 21, 0.1, 3.3, 100),
('Broccoli (cooked)', NULL, 35, 2.4, 7.2, 0.4, 3.3, 100),
('Almonds', NULL, 579, 21, 22, 50, 12.5, 100),
('Banana', NULL, 89, 1.1, 23, 0.3, 2.6, 100),
('Tuna (canned in water)', NULL, 116, 25.5, 0, 0.8, 0, 100),
('Cottage Cheese (low fat)', NULL, 72, 12.5, 2.7, 1, 0, 100),
('Quinoa (cooked)', NULL, 120, 4.4, 21.3, 1.9, 2.8, 100),
('Avocado', NULL, 160, 2, 9, 15, 7, 100),
('Whey Protein Powder', NULL, 370, 80, 7, 5, 1, 100),
('White Rice (cooked)', NULL, 130, 2.7, 28, 0.3, 0.4, 100),
('Beef (lean ground, cooked)', NULL, 218, 26, 0, 12, 0, 100),
('Spinach (raw)', NULL, 23, 2.9, 3.6, 0.4, 2.2, 100),
('Olive Oil', NULL, 884, 0, 0, 100, 0, 100),
('Apple', NULL, 52, 0.3, 14, 0.2, 2.4, 100);
