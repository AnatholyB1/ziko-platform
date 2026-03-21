/**
 * Import food database from USDA SR Legacy + curated French foods
 * into Supabase food_database table.
 *
 * Usage: node import-foods.mjs
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── CSV Parser (simple, handles quoted fields) ──────────
function parseCSV(text) {
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseCSVLine(line);
    if (vals.length !== headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = vals[idx]));
    rows.push(obj);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// ── USDA Nutrient IDs ──────────────────────────────────
const NUTRIENT_IDS = {
  energy: '1008',   // Energy (kcal)
  protein: '1003',  // Protein (g)
  carbs: '1005',    // Carbohydrate, by difference (g)
  fat: '1004',      // Total lipid (fat) (g)
  fiber: '1079',    // Fiber, total dietary (g)
};

// ── Load USDA Data ─────────────────────────────────────
function loadUSDA() {
  const base = resolve(__dirname, 'usda', 'FoodData_Central_sr_legacy_food_csv_2018-04');

  console.log('Loading USDA food.csv...');
  const foodsRaw = parseCSV(readFileSync(resolve(base, 'food.csv'), 'utf-8'));

  console.log('Loading USDA food_nutrient.csv (large file)...');
  const nutrientsRaw = parseCSV(readFileSync(resolve(base, 'food_nutrient.csv'), 'utf-8'));

  // Build nutrient lookup: fdc_id → { energy, protein, carbs, fat, fiber }
  console.log(`Parsed ${nutrientsRaw.length} nutrient rows, building lookup...`);
  const nutrientMap = new Map();

  for (const row of nutrientsRaw) {
    const fdcId = row.fdc_id;
    const nutrientId = row.nutrient_id;
    const amount = parseFloat(row.amount);

    if (isNaN(amount)) continue;

    let key = null;
    if (nutrientId === NUTRIENT_IDS.energy) key = 'calories';
    else if (nutrientId === NUTRIENT_IDS.protein) key = 'protein_g';
    else if (nutrientId === NUTRIENT_IDS.carbs) key = 'carbs_g';
    else if (nutrientId === NUTRIENT_IDS.fat) key = 'fat_g';
    else if (nutrientId === NUTRIENT_IDS.fiber) key = 'fiber_g';
    else continue;

    if (!nutrientMap.has(fdcId)) {
      nutrientMap.set(fdcId, { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
    }
    nutrientMap.get(fdcId)[key] = Math.round(amount * 100) / 100;
  }

  // Combine foods + nutrients
  const foods = [];
  for (const food of foodsRaw) {
    const nutrients = nutrientMap.get(food.fdc_id);
    if (!nutrients || nutrients.calories === 0) continue; // Skip foods with no calorie data

    // Clean up description: remove brand prefixes, trim
    let name = food.description.trim();

    foods.push({
      name,
      brand: null,
      calories: nutrients.calories,
      protein_g: nutrients.protein_g,
      carbs_g: nutrients.carbs_g,
      fat_g: nutrients.fat_g,
      fiber_g: nutrients.fiber_g,
      serving_g: 100,
      barcode: null,
      source: 'usda',
    });
  }

  console.log(`USDA: ${foods.length} foods with nutritional data`);
  return foods;
}

// ── Curated French/European Foods ──────────────────────
function getFrenchFoods() {
  // Source: CIQUAL 2020 (manually curated common items, per 100g)
  const items = [
    // Pains et viennoiseries
    ['Baguette tradition', 282, 9.1, 56, 1.6, 2.7],
    ['Pain complet', 247, 8.8, 46, 2.3, 6.2],
    ['Pain de mie', 277, 8.2, 50, 4.1, 2.5],
    ['Croissant au beurre', 406, 7.5, 45, 21, 2.3],
    ['Pain au chocolat', 414, 7.2, 46, 22, 2.5],
    ['Brioche', 374, 8.2, 47, 16, 1.8],
    ['Pain aux raisins', 327, 6.8, 46, 13, 1.6],
    ['Chausson aux pommes', 277, 3.4, 31, 15, 1.5],

    // Fromages
    ['Camembert', 281, 20, 0.5, 22, 0],
    ['Brie', 334, 21, 0.5, 27, 0],
    ['Emmental', 380, 29, 0.5, 29, 0],
    ['Comt\u00e9', 411, 28, 0.5, 33, 0],
    ['Roquefort', 369, 21, 2, 31, 0],
    ['Ch\u00e8vre frais', 200, 13, 1, 16, 0],
    ['Mozzarella', 253, 18, 1.5, 19, 0],
    ['Parmesan (Parmigiano Reggiano)', 392, 36, 0, 26, 0],
    ['Raclette (fromage)', 345, 23, 0.5, 28, 0],
    ['Boursin', 395, 8, 2.5, 39, 0],
    ['Kiri', 303, 7.5, 3, 29, 0],
    ['Vache qui rit', 229, 10, 5, 19, 0],

    // Plats fran\u00e7ais
    ['Croque-monsieur', 265, 14, 18, 15, 0.8],
    ['Quiche lorraine', 267, 10, 21, 16, 0.9],
    ['Ratatouille', 55, 1.3, 7, 2.3, 1.6],
    ['Gratin dauphinois', 142, 4.5, 13, 8, 1],
    ['Blanquette de veau', 131, 13, 4, 7, 0.3],
    ['Boeuf bourguignon', 155, 15, 5, 8, 0.7],
    ['Pot-au-feu', 96, 9, 5.5, 4, 1.2],
    ['Coq au vin', 148, 14, 4, 8, 0.5],
    ['Cassoulet', 155, 10, 12, 7.5, 3.5],
    ['Tartiflette', 196, 9, 14, 12, 0.8],
    ['Galette bretonne compl\u00e8te', 170, 9, 18, 7, 1.5],
    ['Cr\u00eape sucr\u00e9e', 219, 6, 32, 7.5, 0.8],
    ['Salade ni\u00e7oise', 95, 7, 4, 5.5, 1.2],
    ['Soupe \u00e0 l\'oignon', 38, 1.5, 5, 1, 0.5],
    ['Hachis parmentier', 135, 8, 12, 6, 1.2],
    ['Poulet r\u00f4ti', 190, 27, 0, 9, 0],
    ['Steak hach\u00e9 5% MG', 136, 22, 0, 5, 0],
    ['Steak hach\u00e9 15% MG', 212, 18, 0, 15, 0],
    ['Jambon blanc', 121, 20, 1, 4, 0],
    ['Saucisson sec', 452, 26, 2, 37, 0],
    ['Pâté de campagne', 300, 14, 1, 26, 0],
    ['Rillettes de porc', 426, 16, 0.5, 40, 0],
    ['Foie gras', 462, 7, 4.5, 44, 0],

    // Desserts et p\u00e2tisseries
    ['\u00c9clair au chocolat', 262, 5, 27, 15, 1],
    ['Tarte aux pommes', 240, 2.8, 34, 10, 1.5],
    ['Cr\u00e8me br\u00fbl\u00e9e', 254, 4, 24, 16, 0],
    ['Mousse au chocolat', 222, 5, 20, 13, 1.2],
    ['Fondant au chocolat', 380, 5.5, 38, 23, 2],
    ['Mille-feuille', 333, 5, 35, 19, 0.5],
    ['Paris-Brest', 350, 6, 30, 23, 0.8],
    ['Macaron', 404, 7, 53, 18, 1.5],
    ['Profiterole', 252, 5.5, 26, 14, 0.5],
    ['Cr\u00eape Nutella', 310, 5, 40, 14, 1],
    ['Yaourt nature', 56, 4, 5, 1.8, 0],
    ['Yaourt aux fruits', 97, 3.5, 15, 2.5, 0.3],
    ['Compote de pommes', 68, 0.3, 16, 0.2, 1.5],
    ['\u00cele flottante', 135, 5, 18, 4.5, 0],
    ['Cr\u00e8me caramel', 144, 3.5, 22, 4.5, 0],

    // Produits laitiers
    ['Lait entier', 63, 3.2, 4.8, 3.5, 0],
    ['Lait demi-\u00e9cr\u00e9m\u00e9', 46, 3.3, 4.8, 1.5, 0],
    ['Cr\u00e8me fra\u00eeche 30%', 301, 2.2, 2.8, 31, 0],
    ['Beurre', 745, 0.7, 0.5, 83, 0],
    ['Beurre demi-sel', 717, 0.8, 0.5, 80, 0],
    ['Fromage blanc 0%', 44, 7.5, 3.8, 0.1, 0],
    ['Fromage blanc 20%', 73, 6.8, 3.5, 3.4, 0],
    ['Petit-suisse', 113, 6.5, 5, 7.5, 0],

    // C\u00e9r\u00e9ales et f\u00e9culents
    ['Couscous (semoule cuite)', 112, 3.8, 23, 0.2, 1.2],
    ['Boulgour (cuit)', 83, 3.1, 18, 0.2, 1.8],
    ['Lentilles (cuites)', 116, 9, 20, 0.4, 4],
    ['Pois chiches (cuits)', 164, 8.9, 27, 2.6, 7.6],
    ['Haricots blancs (cuits)', 127, 8.7, 21, 0.5, 6.3],
    ['P\u00e2tes (cuites)', 131, 5, 25, 1.1, 1.4],
    ['Riz basmati (cuit)', 121, 2.7, 26, 0.4, 0.4],
    ['Pur\u00e9e de pommes de terre', 95, 2, 14, 3.5, 1],
    ['Frites', 312, 3.4, 41, 15, 3.8],
    ['Pommes de terre vapeur', 80, 2, 17, 0.1, 1.5],

    // L\u00e9gumes
    ['Courgette (cuite)', 19, 1.3, 2.3, 0.4, 1],
    ['Aubergine (cuite)', 25, 1, 3.5, 0.6, 2.5],
    ['Poivron rouge', 31, 1, 6, 0.3, 2],
    ['Tomate', 18, 0.9, 2.6, 0.2, 1.2],
    ['Carotte (cuite)', 27, 0.6, 5, 0.3, 2.2],
    ['Haricots verts (cuits)', 26, 1.6, 4, 0.2, 2.7],
    ['Petit pois (cuits)', 79, 5.4, 12, 0.4, 4.7],
    ['Champignon de Paris', 22, 3.1, 0.5, 0.3, 1],
    ['Salade verte (laitue)', 13, 1.3, 1.4, 0.2, 1.2],
    ['Concombre', 12, 0.6, 1.8, 0.1, 0.5],
    ['Radis', 14, 0.7, 2, 0.1, 1.6],
    ['Endive', 17, 1.1, 2.4, 0.2, 1.1],
    ['Poireau (cuit)', 24, 1, 4, 0.3, 2],
    ['Chou-fleur (cuit)', 22, 1.8, 2.3, 0.5, 1.8],
    ['Artichaut (cuit)', 28, 2.4, 3, 0.2, 3.5],

    // Fruits
    ['Orange', 47, 0.9, 9.4, 0.3, 2.4],
    ['Poire', 58, 0.4, 12, 0.1, 3.1],
    ['P\u00eache', 39, 0.9, 7, 0.3, 1.5],
    ['Fraise', 33, 0.7, 6, 0.3, 2],
    ['Framboise', 52, 1.2, 5, 0.6, 6.5],
    ['Raisin', 72, 0.6, 16, 0.2, 0.9],
    ['Cerise', 63, 1.1, 12, 0.3, 1.6],
    ['Abricot', 48, 1.4, 9, 0.4, 2],
    ['Cl\u00e9mentine', 47, 0.9, 10, 0.2, 1.7],
    ['Kiwi', 61, 1.1, 10, 0.5, 3],
    ['Mangue', 65, 0.5, 15, 0.3, 1.6],
    ['Ananas', 52, 0.5, 11, 0.1, 1.4],
    ['Melon', 34, 0.8, 7.5, 0.2, 0.9],
    ['Past\u00e8que', 30, 0.6, 7, 0.2, 0.4],
    ['Prune', 49, 0.7, 10, 0.3, 1.4],

    // Poissons et fruits de mer
    ['Thon (cuit)', 144, 23, 0, 5, 0],
    ['Cabillaud (cuit)', 105, 23, 0, 1, 0],
    ['Sardine (conserve)', 208, 25, 0, 11, 0],
    ['Maquereau (cuit)', 205, 19, 0, 14, 0],
    ['Crevettes (cuites)', 99, 21, 0, 1.5, 0],
    ['Moules (cuites)', 86, 12, 3.7, 2.2, 0],
    ['Hu\u00eetres', 81, 9, 5, 2.3, 0],
    ['Truite (cuite)', 139, 20, 0, 6, 0],
    ['Bar/Loup (cuit)', 124, 24, 0, 3, 0],
    ['Dorade (cuite)', 128, 23, 0, 4, 0],

    // Boissons
    ['Jus d\'orange (100% pur jus)', 45, 0.7, 10, 0.2, 0.3],
    ['Jus de pomme', 46, 0.1, 11, 0.1, 0.2],
    ['Coca-Cola', 42, 0, 10.6, 0, 0],
    ['Caf\u00e9 noir (sans sucre)', 2, 0.3, 0, 0, 0],
    ['Th\u00e9 vert (sans sucre)', 1, 0, 0.2, 0, 0],
    ['Bi\u00e8re blonde', 43, 0.3, 3.6, 0, 0],
    ['Vin rouge', 83, 0.1, 2.6, 0, 0],
    ['Vin blanc sec', 82, 0.1, 2.5, 0, 0],

    // Snacks et produits courants
    ['Chips nature', 536, 6, 53, 33, 4.4],
    ['Barre c\u00e9r\u00e9ales', 397, 5, 65, 13, 3],
    ['Chocolat noir 70%', 579, 8, 33, 43, 11],
    ['Chocolat au lait', 545, 7.6, 56, 31, 2],
    ['Nutella', 541, 6.3, 57, 31, 0],
    ['Confiture', 260, 0.4, 63, 0.1, 0.8],
    ['Miel', 304, 0.3, 76, 0, 0],
    ['Biscuit petit beurre', 436, 7, 72, 13, 2.3],
    ['Madeleine', 438, 6, 48, 24, 1],
    ['Pain d\'\u00e9pices', 340, 4, 72, 3.5, 1.5],
    ['Cr\u00e8me de marrons', 258, 0.8, 60, 0.5, 3],

    // Oeufs et produits transform\u00e9s
    ['Oeuf dur', 155, 13, 1.1, 11, 0],
    ['Omelette nature', 154, 11, 0.6, 12, 0],
    ['Quenelle de brochet', 140, 6, 14, 7, 0.5],
    ['Andouillette', 240, 18, 0.5, 18, 0],
    ['Merguez (cuite)', 307, 16, 1, 27, 0],
    ['Saucisse de Strasbourg', 263, 11, 2, 23, 0],
    ['Boudin noir', 297, 11, 14, 22, 0.5],
    ['Knack', 263, 11, 2, 23, 0],

    // Plats du monde courants en France
    ['Couscous royal', 130, 9, 14, 4.5, 1.5],
    ['Tajine de poulet', 120, 12, 8, 5, 1.5],
    ['Pizza Margherita', 240, 10, 30, 9, 1.8],
    ['Pizza 4 fromages', 268, 12, 27, 13, 1],
    ['Kebab (viande)', 215, 18, 3, 14, 0.3],
    ['Couscous l\u00e9gumes', 92, 3, 15, 2, 2],
    ['Paella', 146, 9, 17, 5, 1],
    ['Lasagnes bolognaise', 140, 8, 13, 6, 1],
    ['Spaghetti bolognaise', 133, 7, 15, 5, 1.2],
    ['Ravioli', 175, 7, 22, 6, 1],
    ['Risotto', 138, 4, 22, 4, 0.5],
    ['Sushi (nigiri saumon)', 150, 8, 20, 4, 0.3],
    ['Nems (rouleaux de printemps frits)', 225, 7, 22, 12, 1],
    ['Samossa', 250, 5, 28, 13, 1.5],
    ['Wrap poulet', 195, 11, 20, 8, 1],
    ['Salade C\u00e9sar', 127, 9, 5, 8, 1],
    ['Burger classique (avec pain)', 255, 14, 24, 12, 1],
    ['Fish and chips', 230, 12, 22, 11, 1.5],
    ['Pad tha\u00ef', 175, 8, 22, 6, 1],
    ['Falafel', 333, 13, 32, 18, 5],
    ['Houmous', 166, 8, 14, 9.6, 6],
    ['Taboul\u00e9', 148, 3, 19, 7, 2],

    // Suppl\u00e9ments sportifs courants
    ['Whey Protein (scoop 30g)', 120, 24, 3, 1.5, 0],
    ['Casein Protein (scoop 30g)', 112, 24, 3, 0.5, 0],
    ['Barre prot\u00e9in\u00e9e', 350, 30, 35, 10, 3],
    ['BCAA (5g)', 0, 5, 0, 0, 0],
    ['Cr\u00e9atine (5g)', 0, 0, 0, 0, 0],
    ['Galette de riz (souffl\u00e9)', 387, 8, 81, 3, 3.5],
    ['Amande (en-cas 30g)', 174, 6.3, 6.6, 15, 3.7],
    ['Banane (en-cas 120g)', 107, 1.3, 27.6, 0.4, 3.1],
    ['Lait d\'amande', 24, 0.5, 3, 1.1, 0.2],
    ['Lait d\'avoine', 46, 1, 7, 1.5, 0.8],
    ['Lait de soja', 33, 3.3, 0.5, 1.8, 0.6],
  ];

  return items.map(([name, calories, protein_g, carbs_g, fat_g, fiber_g]) => ({
    name: String(name),
    brand: null,
    calories: Number(calories),
    protein_g: Number(protein_g),
    carbs_g: Number(carbs_g),
    fat_g: Number(fat_g),
    fiber_g: Number(fiber_g),
    serving_g: 100,
    barcode: null,
    source: 'ciqual',
  }));
}

// ── Main Import ────────────────────────────────────────
async function main() {
  console.log('=== Food Database Import ===\n');

  // 1. Load data
  const usdaFoods = loadUSDA();
  const frenchFoods = getFrenchFoods();

  console.log(`\nFrench foods: ${frenchFoods.length} items`);

  // 2. Combine and deduplicate by name (lowercase)
  const seen = new Set();
  const allFoods = [];

  // French foods first (higher priority for naming)
  for (const food of frenchFoods) {
    const key = food.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      allFoods.push(food);
    }
  }

  // Then USDA
  for (const food of usdaFoods) {
    const key = food.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      allFoods.push(food);
    }
  }

  console.log(`Total combined (deduplicated): ${allFoods.length} foods\n`);

  // 3. Clear existing food_database
  console.log('Clearing existing food_database...');
  const { error: delError } = await supabase
    .from('food_database')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

  if (delError) {
    console.error('Delete error:', delError.message);
    // Try alternative: delete with no filter using RPC or just proceed
  }

  // 4. Insert in batches of 500
  const BATCH_SIZE = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < allFoods.length; i += BATCH_SIZE) {
    const batch = allFoods.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('food_database').insert(batch);

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }

    // Progress
    const pct = Math.round(((i + batch.length) / allFoods.length) * 100);
    process.stdout.write(`\rInserting... ${pct}% (${inserted} inserted, ${errors} errors)`);
  }

  console.log(`\n\n=== Done! ===`);
  console.log(`Inserted: ${inserted} foods`);
  console.log(`Errors: ${errors}`);
  console.log(`Sources: USDA SR Legacy + Curated French (CIQUAL-based)`);
}

main().catch(console.error);
