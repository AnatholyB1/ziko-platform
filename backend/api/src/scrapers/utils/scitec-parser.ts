/**
 * Scitec Nutrition parser — scitec.fr (BioTechUSA platform)
 *
 * Strategy:
 *  1. Fetch product sitemap → extract product IDs + URLs
 *  2. Filter out non-supplement categories (t-shirts, gloves, etc.)
 *  3. Call /Product/api/getProductData?id={id} per product
 *  4. Extract: name, price, image, category (from GA4 dataLayer), flavors
 */

const BASE = 'https://scitec.fr';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'X-Requested-With': 'XMLHttpRequest',
};

/** URL-path segments that are NOT supplements (skip these) */
const EXCLUDED_SLUGS = [
  't-shirt',
  'simple-gloves',
  'gloves-with-wrist-wrap',
  'hoodie',
  'shaker',
  'towel',
  'bottle',
  'bag',
  'cap',
  'belt',
  'strap',
  'accessories',
];

const CONCURRENCY = 3;
const DELAY_MS = 300;

export interface ScitecRawProduct {
  name: string;
  price: number;
  imageUrl?: string;
  sourceUrl: string;
  categoryText: string;
  flavors: string[];
  inStock: boolean;
}

/* ---------- sitemap ---------- */

interface SitemapEntry {
  id: number;
  url: string;
  pathCategory: string;
}

async function getProductsFromSitemap(): Promise<SitemapEntry[]> {
  const res = await fetch(`${BASE}/media/sitemaps/sitemap_51_product.xml`, {
    headers: { ...HEADERS, Accept: 'text/xml' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Sitemap HTTP ${res.status}`);
  const xml = await res.text();

  const locs =
    xml.match(/<loc>([^<]+)<\/loc>/g)?.map((m) => m.replace(/<\/?loc>/g, '')) ?? [];

  const entries: SitemapEntry[] = [];
  for (const loc of locs) {
    const idMatch = loc.match(/-p(\d+)$/);
    if (!idMatch) continue;

    // extract the first path segment after the domain → e.g. "whey-protein-concentrate"
    const catMatch = loc.match(/scitec\.fr\/([^/]+)\//);
    const pathCategory = catMatch ? catMatch[1] : '';

    // skip non‑supplement pages
    if (EXCLUDED_SLUGS.some((s) => pathCategory.includes(s))) continue;

    entries.push({ id: parseInt(idMatch[1], 10), url: loc, pathCategory });
  }

  return entries;
}

/* ---------- product API ---------- */

function parsePrice(formatted: string): number {
  // "94,90 €" → 94.9 | "22,32 €" → 22.32
  const cleaned = formatted.replace(/[^0-9,.]/g, '').replace(',', '.');
  return parseFloat(cleaned);
}

async function fetchProductData(
  entry: SitemapEntry,
): Promise<ScitecRawProduct | null> {
  const url = `${BASE}/Product/api/getProductData?id=${entry.id}`;
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;

  const data: any = await res.json();
  if (!data?.name || !data?.price) return null;

  const price = parsePrice(data.price);
  if (isNaN(price) || price <= 0) return null;

  // Image — first entry in imageList or fallback
  const imagePath: string | undefined = data.imageList?.[0] ?? undefined;
  const imageUrl = imagePath ? `${BASE}${imagePath}` : undefined;

  // Category from GA4 dataLayer (item_category_2 → "Protein Powders", item_category_3 → "Whey Protein Concentrate")
  const dl = data.dataLayerItemData;
  const categoryText = [dl?.item_category_2, dl?.item_category_3, data.name]
    .filter(Boolean)
    .join(' ');

  // Flavors from paramVariantList labels
  const flavors: string[] = (data.paramVariantList ?? [])
    .map((v: { label: string; isActive: number }) =>
      v.isActive ? v.label : null,
    )
    .filter(Boolean);

  // Stock
  const stockInfo = data.stockInfo ?? {};
  const inStock = !!stockInfo.inStock;

  return {
    name: data.name,
    price,
    imageUrl,
    sourceUrl: entry.url,
    categoryText,
    flavors,
    inStock,
  };
}

/* ---------- public ---------- */

export async function fetchScitecProducts(): Promise<{
  products: ScitecRawProduct[];
  errors: string[];
}> {
  const errors: string[] = [];

  let entries: SitemapEntry[];
  try {
    entries = await getProductsFromSitemap();
  } catch (e: any) {
    return { products: [], errors: [`Sitemap fetch failed: ${e.message}`] };
  }

  if (entries.length === 0) {
    return { products: [], errors: ['No product entries in sitemap'] };
  }

  const products: ScitecRawProduct[] = [];

  // Fetch in batches with concurrency limit
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((entry) => fetchProductData(entry)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        products.push(result.value);
      } else if (result.status === 'rejected') {
        errors.push(result.reason?.message ?? 'Unknown fetch error');
      }
    }

    // Small delay between batches
    if (i + CONCURRENCY < entries.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  return { products, errors };
}
