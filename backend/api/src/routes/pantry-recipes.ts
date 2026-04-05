import { Hono } from 'hono';
import { generateObject, NoObjectGeneratedError } from 'ai';
import { AGENT_MODEL } from '../config/models.js';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { clientForUser } from '../tools/db.js';

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

const DAILY_TARGETS = { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 };

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

router.post('/recipes/suggest', async (c) => {
  const auth = c.get('auth');
  const { userId } = auth;

  const userToken = c.req.header('Authorization')?.replace('Bearer ', '');

  const body: { preferences?: string } = await c.req.json<{ preferences?: string }>().catch(() => ({}));

  const today = new Date().toISOString().split('T')[0];

  const db = clientForUser(userToken);

  const [pantryRes, nutritionRes] = await Promise.all([
    db
      .from('pantry_items')
      .select('id, name, quantity, unit, food_category, storage_location')
      .eq('user_id', userId)
      .order('name'),
    db
      .from('nutrition_logs')
      .select('calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .eq('date', today),
  ]);

  const meals = nutritionRes.data ?? [];
  const consumed = {
    calories: meals.reduce((s: number, m: any) => s + (Number(m.calories) || 0), 0),
    protein_g: meals.reduce((s: number, m: any) => s + (Number(m.protein_g) || 0), 0),
    carbs_g: meals.reduce((s: number, m: any) => s + (Number(m.carbs_g) || 0), 0),
    fat_g: meals.reduce((s: number, m: any) => s + (Number(m.fat_g) || 0), 0),
  };
  const remaining_macros = {
    calories: Math.max(0, DAILY_TARGETS.calories - consumed.calories),
    protein_g: Math.max(0, DAILY_TARGETS.protein_g - consumed.protein_g),
    carbs_g: Math.max(0, DAILY_TARGETS.carbs_g - consumed.carbs_g),
    fat_g: Math.max(0, DAILY_TARGETS.fat_g - consumed.fat_g),
  };

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
