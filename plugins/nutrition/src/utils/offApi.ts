export interface FoodProduct {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  energy_kcal: number;
  proteins_g: number;
  carbs_g: number;
  fat_g: number;
  nutriscore_grade: string | null;
  ecoscore_grade: string | null;
  image_url: string | null;
  serving_size_g: number;
  created_at: string;
}

const OFF_PRODUCTION_URL = (barcode: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,product_name_fr,nutriments,nutriscore_grade,ecoscore_grade,image_front_small_url,serving_size,brands`;

export async function getOrFetchProduct(barcode: string, supabase: any): Promise<FoodProduct | null> {
  // 1. Check Supabase cache first
  const { data: cached } = await supabase
    .from('food_products')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();
  if (cached) return cached as FoodProduct;

  // 2. Fetch from Open Food Facts production URL
  const res = await fetch(OFF_PRODUCTION_URL(barcode));
  const json = await res.json();
  if (json.status !== 1) return null;

  // 3. Parse and normalize
  const p = json.product;
  const servingRaw: string | undefined = p.serving_size;
  const servingMatch = servingRaw?.match(/([\d.]+)\s*g/i);
  const serving_size_g = servingMatch ? Math.round(parseFloat(servingMatch[1])) : 100;

  const rawEcoscore = p.ecoscore_grade ?? null;
  const ecoscore_grade = (rawEcoscore === 'not-applicable' || rawEcoscore === 'unknown') ? null : rawEcoscore;

  const product: Omit<FoodProduct, 'id' | 'created_at'> = {
    barcode,
    name: p.product_name_fr ?? p.product_name ?? barcode,
    brand: p.brands ?? null,
    energy_kcal: Math.round(p.nutriments?.['energy-kcal_100g'] ?? 0),
    proteins_g: p.nutriments?.proteins_100g ?? 0,
    carbs_g: p.nutriments?.carbohydrates_100g ?? 0,
    fat_g: p.nutriments?.fat_100g ?? 0,
    nutriscore_grade: p.nutriscore_grade ?? null,
    ecoscore_grade,
    image_url: p.image_front_small_url ?? null,
    serving_size_g,
  };

  // 4. Insert into cache (best-effort, upsert on conflict to handle race conditions)
  const { data: inserted } = await supabase
    .from('food_products')
    .upsert(product, { onConflict: 'barcode' })
    .select()
    .maybeSingle();

  return (inserted as FoodProduct) ?? ({ ...product, id: '', created_at: '' } as FoodProduct);
}
