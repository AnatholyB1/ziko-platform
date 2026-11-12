import { Hono } from 'hono';
import { generateObject, NoObjectGeneratedError } from 'ai';
import { AGENT_MODEL } from '../config/models.js';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { clientForUser } from '../tools/db.js';
import { creditCheck, creditDeduct } from '../middleware/creditGate.js';
import { resolveTargets, resolveDate, sumMeals, remainingMacros } from './pantry-recipes-macros.js';

const RecipeIngredientSchema = z.object({
  name: z.string().describe('Ingredient name in French'),
  quantity: z.number().describe('Amount needed'),
  unit: z.string().describe('Unit of measurement (g, kg, ml, L, pieces, etc.)'),
  pantry_item_id: z.string().optional().describe('ID of the matching pantry item from the list (only set when this ingredient comes from the pantry)'),
});

const RecipeMacrosSchema = z.object({
  calories: z.number().describe('Total calories for base_servings portions'),
  protein_g: z.number().describe('Protein in grams for base_servings portions'),
  carbs_g: z.number().describe('Carbohydrates in grams for base_servings portions'),
  fat_g: z.number().describe('Fat in grams for base_servings portions'),
});

const RecipeSchema = z.object({
  id: z.string().describe('Short unique slug, e.g. "poulet-roti" or "omelette-champignons"'),
  name: z.string().describe('Recipe name in French'),
  description: z.string().describe('One sentence description in French'),
  prep_time_min: z.number().describe('Total preparation + cooking time in minutes'),
  base_servings: z.number().describe('Number of servings this recipe makes (1 or 2)'),
  ingredients: z.array(RecipeIngredientSchema),
  macros: RecipeMacrosSchema,
  steps: z.array(z.string()).describe('Ordered cooking steps in French'),
});

const ResponseSchema = z.object({
  recipes: z.array(RecipeSchema),
});

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function wordOverlapMatch(pantryName: string, ingredientName: string): boolean {
  const wordsP = normalizeStr(pantryName).split(/\s+/).filter((w) => w.length > 2);
  const wordsI = normalizeStr(ingredientName).split(/\s+/).filter((w) => w.length > 2);
  // At least one significant word must appear in both
  return wordsI.some((w) => wordsP.includes(w));
}

const router = new Hono();
router.use('*', authMiddleware);

// 1 credit per generation (Phase 10, D-08): creditCheck gates (402), creditDeduct charges only on success.
router.post('/recipes/suggest', creditCheck('recipes'), creditDeduct('recipes'), async (c) => {
  const auth = c.get('auth');
  const { userId } = auth;

  const userToken = c.req.header('Authorization')?.replace('Bearer ', '');

  const body: { preferences?: string; date?: string } = await c.req
    .json<{ preferences?: string; date?: string }>()
    .catch(() => ({}));

  // Date LOCALE du client (D-09) : evite le decalage UTC la nuit.
  const today = resolveDate(body.date);

  const db = clientForUser(userToken);

  const [pantryRes, nutritionRes, settingsRes] = await Promise.all([
    db
      .from('ziko_pantry_items')
      .select('id, name, quantity, unit, food_category, storage_location')
      .eq('user_id', userId)
      .order('name'),
    db
      .from('ziko_nutrition_logs')
      .select('calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .eq('date', today),
    db
      .from('ziko_user_plugins')
      .select('settings')
      .eq('user_id', userId)
      .eq('plugin_id', 'nutrition')
      .maybeSingle(),
  ]);

  // Objectifs reels de l'utilisateur (repli sur les constantes), moins ce qui a ete logue ce jour-la.
  const targets = resolveTargets(settingsRes?.data?.settings);
  const consumed = sumMeals((nutritionRes.data ?? []) as Array<Record<string, unknown>>);
  const remaining_macros = remainingMacros(targets, consumed);

  const pantryItems = pantryRes.data ?? [];
  const pantryListStr =
    pantryItems.length > 0
      ? pantryItems.map((item: any) => `[ID:${item.id}] ${item.name}: ${item.quantity} ${item.unit} (${item.food_category})`).join('\n')
      : 'Le garde-manger est vide.';

  const prompt = `Génère EXACTEMENT 3 recettes en utilisant principalement les ingrédients suivants du garde-manger :

${pantryListStr}

Budget nutritionnel restant pour aujourd'hui :
- Calories : ${remaining_macros.calories} kcal
- Protéines : ${remaining_macros.protein_g}g
- Glucides : ${remaining_macros.carbs_g}g
- Lipides : ${remaining_macros.fat_g}g

${body.preferences ? `Préférences de l'utilisateur : ${body.preferences}\n\n` : ''}Règles importantes :
- Utilise principalement les ingrédients listés ci-dessus
- Adapte les recettes au budget nutritionnel restant (recettes légères si budget faible)
- Noms de recettes, descriptions et étapes en FRANÇAIS
- Quantités réalistes et temps de préparation honnêtes
- Génère exactement 3 recettes différentes
- IMPORTANT : pour chaque ingrédient qui vient du garde-manger, set pantry_item_id avec l'ID entre crochets [ID:...] de la liste ci-dessus`;

  try {
    const { object } = await generateObject({
      model: AGENT_MODEL,
      schema: ResponseSchema,
      maxOutputTokens: 2000,
      system:
        'Tu es un chef cuisinier français expert en nutrition. Tu génères des recettes structurées, réalistes et savoureuses basées sur les ingrédients disponibles. Respecte toujours le format JSON demandé.',
      prompt,
    });
    // Inject pantry_item_id server-side — AI instructions alone are unreliable
    for (const recipe of object.recipes) {
      for (const ingredient of recipe.ingredients) {
        if (!ingredient.pantry_item_id) {
          const match = pantryItems.find((item: any) => wordOverlapMatch(item.name, ingredient.name));
          if (match) ingredient.pantry_item_id = match.id;
        }
      }
    }
    return c.json({ recipes: object.recipes, remaining_macros });
  } catch (err) {
    if (err instanceof NoObjectGeneratedError) {
      console.error('[Recipe Generation Error]', err.text);
      return c.json({ error: 'Impossible de générer des recettes. Veuillez réessayer.' }, 500);
    }
    throw err;
  }
});

export { router as pantryRecipesRouter };
