/**
 * Convert Kaggle fitness exercises CSV → SQL INSERT statements
 * Run: node scripts/csv-to-seed.js
 * Output: supabase/seed_exercises.sql
 */
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'kaggle_data', 'exercises.csv');
const outPath = path.join(__dirname, '..', 'supabase', 'seed_exercises.sql');

// --- Simple CSV parser (handles quoted fields with commas) ---
function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === '\n' && !inQuotes) {
      if (current.trim()) lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  const header = splitRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    const obj = {};
    header.forEach((h, idx) => { obj[h.trim()] = (cols[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

function splitRow(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

// --- Map bodyPart → category ---
function mapCategory(bodyPart) {
  if (bodyPart === 'cardio') return 'cardio';
  return 'strength';
}

// --- Map bodyPart+target → muscle_groups array ---
function buildMuscleGroups(target, secondaries) {
  const all = [target, ...secondaries].filter(Boolean);
  return [...new Set(all)];
}

// --- Escape for SQL ---
function esc(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

function sqlArray(arr) {
  if (!arr || arr.length === 0) return "'{}'";
  return `ARRAY[${arr.map(s => `'${esc(s)}'`).join(',')}]`;
}

// --- Main ---
const raw = fs.readFileSync(csvPath, 'utf-8');
const rows = parseCSV(raw);

console.log(`Parsed ${rows.length} exercises`);

// Collect unique names to deduplicate
const seen = new Set();
const exercises = [];

for (const row of rows) {
  const name = row.name || '';
  if (!name || seen.has(name.toLowerCase())) continue;
  seen.add(name.toLowerCase());

  const bodyPart = row.bodyPart || '';
  const equipment = row.equipment || '';
  const target = row.target || '';
  const gifUrl = row.gifUrl || '';

  // Collect secondary muscles
  const secondaries = [];
  for (let i = 0; i <= 5; i++) {
    const val = row[`secondaryMuscles/${i}`];
    if (val) secondaries.push(val);
  }

  // Collect instructions
  const instructions = [];
  for (let i = 0; i <= 10; i++) {
    const val = row[`instructions/${i}`];
    if (val) instructions.push(val);
  }

  const category = mapCategory(bodyPart);
  const muscleGroups = buildMuscleGroups(target, secondaries);
  const instructionText = instructions.join(' ');

  exercises.push({
    name,
    category,
    bodyPart,
    equipment,
    target,
    secondaries,
    muscleGroups,
    instructions: instructionText,
    gifUrl,
  });
}

console.log(`Unique exercises: ${exercises.length}`);

// Generate SQL
let sql = `-- ============================================================
-- EXERCISES SEED — Generated from Kaggle Fitness Exercises Dataset
-- https://www.kaggle.com/datasets/omarxadel/fitness-exercises-dataset
-- License: MIT
-- Total: ${exercises.length} exercises
-- ============================================================

-- Delete old default exercises to avoid duplicates, keep user-created ones
DELETE FROM public.exercises WHERE is_custom = FALSE AND user_id IS NULL;

`;

// Batch inserts (50 per statement to avoid SQL limits)
const BATCH = 50;
for (let i = 0; i < exercises.length; i += BATCH) {
  const batch = exercises.slice(i, i + BATCH);
  sql += `INSERT INTO public.exercises (name, category, muscle_groups, instructions, body_part, equipment, target_muscle, secondary_muscles, gif_url, is_custom) VALUES\n`;

  const values = batch.map(ex => {
    return `  ('${esc(ex.name)}', '${esc(ex.category)}', ${sqlArray(ex.muscleGroups)}, '${esc(ex.instructions)}', '${esc(ex.bodyPart)}', '${esc(ex.equipment)}', '${esc(ex.target)}', ${sqlArray(ex.secondaries)}, '${esc(ex.gifUrl)}', FALSE)`;
  });

  sql += values.join(',\n') + ';\n\n';
}

fs.writeFileSync(outPath, sql, 'utf-8');
console.log(`Written to ${outPath}`);
console.log(`File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
