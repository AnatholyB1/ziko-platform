/**
 * MyProtein HTML parser — scrapes products from fr.myprotein.com category pages.
 * MyProtein uses THG (The Hut Group) platform, no public JSON API.
 * Category pages embed JSON-LD structured data (schema.org ItemList + Product)
 * which contains name, URL, image, and price — we parse that.
 */

export interface MyProteinProduct {
  name: string;
  productId: string;
  url: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
}

/** Category pages to scrape, mapped to our supplement category slugs */
export const MYPROTEIN_CATEGORIES: { url: string; categorySlug: string }[] = [
  { url: 'https://fr.myprotein.com/c/nutrition/protein/whey-protein/', categorySlug: 'protein' },
  { url: 'https://fr.myprotein.com/c/nutrition/protein/vegan-protein/', categorySlug: 'protein' },
  { url: 'https://fr.myprotein.com/c/nutrition/protein/milk-protein/', categorySlug: 'protein' },
  { url: 'https://fr.myprotein.com/c/nutrition/creatine/', categorySlug: 'creatine' },
  { url: 'https://fr.myprotein.com/c/nutrition/amino-acids/', categorySlug: 'bcaa-eaa' },
  { url: 'https://fr.myprotein.com/c/nutrition/pre-post-workout/pre-workout/', categorySlug: 'pre-workout' },
  { url: 'https://fr.myprotein.com/c/nutrition/vitamins-minerals/', categorySlug: 'vitamins' },
  { url: 'https://fr.myprotein.com/c/nutrition/weight-management/', categorySlug: 'fat-burner' },
  { url: 'https://fr.myprotein.com/c/nutrition/healthy-food-drinks/protein-bars/', categorySlug: 'protein' },
];

interface JsonLdOffer {
  '@type': string;
  priceCurrency: string;
  price: string | number;
}

interface JsonLdProduct {
  '@type': string;
  '@id': string;
  name: string;
  url: string;
  sku?: number | string;
  image?: string;
  offers?: JsonLdOffer;
}

interface JsonLdItemList {
  '@type': string;
  numberOfItems?: number;
  itemListElement?: JsonLdProduct[];
}

interface JsonLdGraph {
  '@context': string;
  '@graph': (JsonLdItemList | { '@type': string })[];
}

/**
 * Fetch one MyProtein category page and extract products from JSON-LD structured data.
 * THG embeds schema.org ItemList with Product entries incl. name, url, image, and price.
 * Pagination supported via ?pageNumber=N.
 */
export async function fetchMyProteinCategory(
  categoryUrl: string,
  maxPages = 2,
): Promise<{ products: MyProteinProduct[]; errors: string[] }> {
  const products: MyProteinProduct[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1 ? categoryUrl : `${categoryUrl}?pageNumber=${page}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        if (page === 1) errors.push(`MyProtein HTTP ${response.status} for ${categoryUrl}`);
        break;
      }

      const html = await response.text();
      const pageProducts = parseJsonLd(html);

      if (pageProducts.length === 0) {
        if (page === 1) errors.push(`No JSON-LD products found on ${categoryUrl}`);
        break;
      }

      for (const p of pageProducts) {
        if (!seen.has(p.productId)) {
          seen.add(p.productId);
          products.push(p);
        }
      }

      // If fewer products than a standard full page, no more pages
      if (pageProducts.length < 16) break;
    } catch (err: any) {
      errors.push(`Fetch failed for ${categoryUrl}: ${err.message}`);
      break;
    }
  }

  return { products, errors };
}

/**
 * Extract product list from JSON-LD script tag in MyProtein HTML.
 * THG embeds a @graph array containing BreadcrumbList and ItemList.
 * The ItemList contains Product entries with name, url, image, and offers.
 */
function parseJsonLd(html: string): MyProteinProduct[] {
  // Find the first application/ld+json block
  const startTag = '<script type="application/ld+json">';
  const startIdx = html.indexOf(startTag);
  if (startIdx === -1) return [];

  const endIdx = html.indexOf('</script>', startIdx);
  if (endIdx === -1) return [];

  let graph: JsonLdGraph;
  try {
    graph = JSON.parse(html.substring(startIdx + startTag.length, endIdx));
  } catch {
    return [];
  }

  if (!graph['@graph'] || !Array.isArray(graph['@graph'])) return [];

  const itemList = graph['@graph'].find(
    (node): node is JsonLdItemList => (node as JsonLdItemList)['@type'] === 'ItemList',
  );
  if (!itemList?.itemListElement?.length) return [];

  const products: MyProteinProduct[] = [];

  for (const item of itemList.itemListElement) {
    if (item['@type'] !== 'Product') continue;
    if (!item.name || !item.url) continue;

    // Extract product ID from SKU or URL
    const productId = item.sku
      ? String(item.sku)
      : (item.url.match(/\/(\d+)\/?$/) ?? [])[1] ?? '';
    if (!productId) continue;

    const price = item.offers?.price != null
      ? parseFloat(String(item.offers.price))
      : null;
    const currency = item.offers?.priceCurrency ?? 'EUR';

    products.push({
      name: item.name.trim(),
      productId,
      url: item.url.startsWith('http')
        ? item.url
        : `https://fr.myprotein.com${item.url}`,
      price,
      currency,
      imageUrl: item.image ?? null,
    });
  }

  return products;
}
