/**
 * Convert exercises JSON (from PowerShell) → SQL INSERT statements
 * Run: node scripts/json-to-seed.js
 * Output: supabase/seed_exercises.sql
 */
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'kaggle_data', 'exercises.json');
const outPath = path.join(__dirname, '..', 'supabase', 'seed_exercises.sql');

// Strip BOM if present (PowerShell UTF-8 files often have BOM)
let raw = fs.readFileSync(jsonPath, 'utf-8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

const exercises = JSON.parse(raw);
console.log(`Loaded ${exercises.length} exercises from JSON`);

// Map bodyPart → category
function mapCategory(bodyPart) {
  if (bodyPart === 'cardio') return 'cardio';
  return 'strength';
}

// Escape for SQL
function esc(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

function sqlArray(arr) {
  if (!arr || arr.length === 0) return "'{}'";
  const items = Array.isArray(arr) ? arr : [arr];
  const filtered = items.filter(Boolean);
  if (filtered.length === 0) return "'{}'";
  return `ARRAY[${filtered.map(s => `'${esc(s)}'`).join(',')}]`;
}

// Deduplicate by name
const seen = new Set();
const unique = [];
for (const ex of exercises) {
  const key = (ex.name || '').toLowerCase();
  if (!key || seen.has(key)) continue;
  seen.add(key);
  unique.push(ex);
}
console.log(`Unique exercises: ${unique.length}`);

// Build muscle_groups from target + secondaryMuscles
function buildMuscleGroups(target, secondaries) {
  const all = [target];
  const secs = Array.isArray(secondaries) ? secondaries : (secondaries ? [secondaries] : []);
  all.push(...secs);
  return [...new Set(all.filter(Boolean))];
}

// Build instructions text
function buildInstructions(ins) {
  if (!ins) return '';
  const arr = Array.isArray(ins) ? ins : [ins];
  return arr.filter(Boolean).join(' ');
}

// Generate SQL
let sql = `-- ============================================================
-- EXERCISES SEED — Generated from Kaggle Fitness Exercises Dataset
-- https://www.kaggle.com/datasets/omarxadel/fitness-exercises-dataset
-- License: MIT
-- Total: ${unique.length} exercises
-- ============================================================

-- Delete old default exercises to avoid duplicates, keep user-created ones
DELETE FROM public.exercises WHERE is_custom = FALSE AND user_id IS NULL;

`;

const BATCH = 50;
for (let i = 0; i < unique.length; i += BATCH) {
  const batch = unique.slice(i, i + BATCH);
  sql += `INSERT INTO public.exercises (name, category, muscle_groups, instructions, body_part, equipment, target_muscle, secondary_muscles, gif_url, is_custom) VALUES\n`;

  const values = batch.map(ex => {
    const category = mapCategory(ex.bodyPart);
    const muscleGroups = buildMuscleGroups(ex.target, ex.secondaryMuscles);
    const secondaries = Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles.filter(Boolean) : (ex.secondaryMuscles ? [ex.secondaryMuscles] : []);
    const instructions = buildInstructions(ex.instructions);

    return `  ('${esc(ex.name)}', '${esc(category)}', ${sqlArray(muscleGroups)}, '${esc(instructions)}', '${esc(ex.bodyPart)}', '${esc(ex.equipment)}', '${esc(ex.target)}', ${sqlArray(secondaries)}, '${esc(ex.gifUrl)}', FALSE)`;
  });

  sql += values.join(',\n') + ';\n\n';
}

fs.writeFileSync(outPath, sql, 'utf-8');
console.log(`Written to ${outPath}`);
console.log(`File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
