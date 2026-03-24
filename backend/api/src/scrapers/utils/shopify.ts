/**
 * Shopify JSON API utility — fetches products from any Shopify store
 * via their public /products.json endpoint.
 */

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  product_type: string;
  tags: string[];
  vendor: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  options: ShopifyOption[];
}

export interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  available: boolean;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

export interface ShopifyImage {
  id: number;
  src: string;
  position: number;
}

export interface ShopifyOption {
  name: string;
  values: string[];
}

/**
 * Fetch products from a Shopify store's public JSON API.
 * Paginates to get up to maxPages * 250 products.
 */
export async function fetchShopifyProducts(
  storeUrl: string,
  maxPages = 2,
): Promise<{ products: ShopifyProduct[]; errors: string[] }> {
  const products: ShopifyProduct[] = [];
  const errors: string[] = [];
  const baseUrl = storeUrl.replace(/\/+$/, '');

  try {
    for (let page = 1; page <= maxPages; page++) {
      const url = `${baseUrl}/products.json?limit=250&page=${page}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ZikoBot/1.0 (supplement-comparison)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        if (page === 1) {
          errors.push(`Shopify API returned HTTP ${response.status}`);
        }
        break;
      }

      const data = await response.json() as { products?: ShopifyProduct[] };
      if (!data?.products?.length) break;

      products.push(...data.products);

      // If fewer than 250, we've reached the last page
      if (data.products.length < 250) break;
    }
  } catch (err: any) {
    errors.push(`Shopify fetch failed: ${err.message}`);
  }

  return { products, errors };
}

/** Strip HTML tags and decode common entities */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Extract cheapest available variant, or first variant as fallback */
export function getCheapestVariant(variants: ShopifyVariant[]): ShopifyVariant | undefined {
  const available = variants.filter(v => v.available);
  const pool = available.length > 0 ? available : variants;
  return pool.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
}

/** Extract flavor/saveur option values from a Shopify product */
export function extractFlavors(options: ShopifyOption[]): string[] {
  const flavorOption = options.find(o => {
    const name = o.name.toLowerCase();
    return name.includes('saveur') || name.includes('flavor') || name.includes('flavour')
      || name.includes('goût') || name.includes('gout');
  });
  return flavorOption?.values ?? [];
}

/** Extract size/weight option from a Shopify product (e.g. "900g", "2.27kg", "60 caps") */
export function extractSize(options: ShopifyOption[], variant: ShopifyVariant): string | undefined {
  // Try to find a size/weight/taille option
  const sizeOption = options.find(o => {
    const name = o.name.toLowerCase();
    return name.includes('size') || name.includes('taille') || name.includes('poids')
      || name.includes('weight') || name.includes('format') || name.includes('contenance');
  });

  // Use the selected variant's option value if found
  if (sizeOption) {
    const optionIndex = options.indexOf(sizeOption);
    const key = `option${optionIndex + 1}` as 'option1' | 'option2' | 'option3';
    return variant[key] || sizeOption.values[0] || undefined;
  }

  // Fallback: check variant title for size patterns
  if (variant.title && variant.title !== 'Default Title') {
    if (/\d+\s*(g|kg|ml|l|caps|capsules|tablets|comprimés|gélules|sachets|tabs|softgels)\b/i.test(variant.title)) {
      return variant.title;
    }
  }
  return undefined;
}

/** Parse serving info from product HTML description */
export function parseServingFromHtml(html: string): {
  servingSize?: string;
  servingsPerContainer?: number;
  nutritionPerServing?: Record<string, number>;
} {
  if (!html) return {};
  const text = stripHtml(html);
  const result: ReturnType<typeof parseServingFromHtml> = {};

  // Serving size patterns (EN + FR)
  const servingSizeMatch = text.match(
    /(?:serving size|portion|dose)[:\s]*([0-9]+(?:[.,][0-9]+)?\s*(?:g|ml|scoop|capsule|gélule|comprimé|tablet|softgel)s?(?:\s*\([^)]+\))?)/i
  );
  if (servingSizeMatch) result.servingSize = servingSizeMatch[1].trim();

  // Servings per container patterns (also "X servings" in parentheses or standalone)
  const servingsMatch = text.match(
    /(?:servings? per container|portions? par (?:contenant|emballage|boîte)|nombre de (?:portions?|doses?))[:\s]*(?:environ\s*|approx\.?\s*)?([0-9]+)/i
  ) ?? text.match(
    /\(([0-9]+)\s*servings?\)/i
  ) ?? text.match(
    /([0-9]+)\s*(?:servings?|portions?|doses?)\s*(?:per|par)\s*/i
  );
  if (servingsMatch) result.servingsPerContainer = parseInt(servingsMatch[1], 10);

  // Nutrition values — both "Protein: 25g" and "25g Protein" formats
  const nutrition: Record<string, number> = {};
  const nutrientPatterns: [string, RegExp[]][] = [
    ['calories', [
      /(?:calories|énergie|energy)[:\s]*([0-9]+(?:[.,][0-9]+)?)\s*(?:kcal)?/i,
      /([0-9]+(?:[.,][0-9]+)?)\s*(?:kcal|calories)/i,
    ]],
    ['protein_g', [
      /(?:protein|protéine|protéines)[:\s]*([0-9]+(?:[.,][0-9]+)?)\s*g/i,
      /([0-9]+(?:[.,][0-9]+)?)\s*g\s*(?:of\s*)?(?:protein|protéine)/i,
    ]],
    ['carbs_g', [
      /(?:carbohydrate|glucide|glucides|carbs)[:\s]*([0-9]+(?:[.,][0-9]+)?)\s*g/i,
      /([0-9]+(?:[.,][0-9]+)?)\s*g\s*(?:of\s*)?(?:carb|glucide)/i,
    ]],
    ['fat_g', [
      /(?:fat|lipide|lipides|matières grasses)[:\s]*([0-9]+(?:[.,][0-9]+)?)\s*g/i,
      /([0-9]+(?:[.,][0-9]+)?)\s*g\s*(?:of\s*)?(?:fat|lipide)/i,
    ]],
    ['fiber_g', [
      /(?:fib(?:er|re)|fibres)[:\s]*([0-9]+(?:[.,][0-9]+)?)\s*g/i,
    ]],
    ['sugar_g', [
      /(?:sugar|sucre|sucres)[:\s]*([0-9]+(?:[.,][0-9]+)?)\s*g/i,
    ]],
  ];
  for (const [key, patterns] of nutrientPatterns) {
    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (m) { nutrition[key] = parseFloat(m[1].replace(',', '.')); break; }
    }
  }
  if (Object.keys(nutrition).length > 0) result.nutritionPerServing = nutrition;

  return result;
}

/** Parse serving/container info from product name (e.g. "Whey 900g", "BCAA 120 capsules") */
export function parseServingFromName(name: string): {
  servingSize?: string;
  servingsPerContainer?: number;
} {
  const result: { servingSize?: string; servingsPerContainer?: number } = {};

  // Weight-based products (powder): "900g", "1kg", "2.27kg", "1.5 kg"
  const weightMatch = name.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i);
  if (weightMatch) {
    const val = parseFloat(weightMatch[1].replace(',', '.'));
    const unit = weightMatch[2].toLowerCase();
    result.servingSize = `${val}${unit}`;
  }

  // Count-based products (caps, tabs): "120 capsules", "60 caps", "90 gélules"
  const countMatch = name.match(/(\d+)\s*(capsule|cap|gélule|gelule|comprimé|tablet|tab|softgel)s?\b/i);
  if (countMatch) {
    result.servingsPerContainer = parseInt(countMatch[1], 10);
    result.servingSize = '1 ' + countMatch[2].toLowerCase();
  }

  // Sachet/serving count: "30 sachets", "20 servings"
  const sachetMatch = name.match(/(\d+)\s*(sachet|serving|dose|portion|stick)s?\b/i);
  if (sachetMatch && !countMatch) {
    result.servingsPerContainer = parseInt(sachetMatch[1], 10);
  }

  return result;
}
