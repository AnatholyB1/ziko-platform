/**
 * NOW Foods HTML parser — scrapes products from nowfoods.com category pages.
 * NOW Foods uses Drupal (not Shopify). Cloudflare blocks regular UA,
 * but allows Googlebot. Product data is embedded in GA4 data attributes
 * on <article> elements: data-product-details-ga4="...".
 */

export interface NowFoodsProduct {
  name: string;
  url: string;
  price: number;
  size: string;
  imageUrl: string | null;
  inStock: boolean;
}

/** Category pages to scrape, mapped to our supplement category slugs */
export const NOWFOODS_CATEGORIES: { path: string; categorySlug: string }[] = [
  { path: '/products/sports-nutrition/category/protein-powders', categorySlug: 'protein' },
  { path: '/products/sports-nutrition/category/amino-acids', categorySlug: 'bcaa-eaa' },
  { path: '/products/sports-nutrition/category/energy-production', categorySlug: 'creatine' },
  { path: '/products/sports-nutrition/category/mass-building', categorySlug: 'gainer' },
  { path: '/products/sports-nutrition/category/recovery', categorySlug: 'sleep-recovery' },
  { path: '/products/sports-nutrition/category/weight-management', categorySlug: 'fat-burner' },
  { path: '/products/sports-nutrition/category/endurance', categorySlug: 'pre-workout' },
  { path: '/products/sports-nutrition/category/mens-health', categorySlug: 'vitamins' },
];

const BASE_URL = 'https://www.nowfoods.com';
const HEADERS = {
  'Accept': 'text/html',
  'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
};

interface GA4Variation {
  item_id: string;
  price: string;
  item_variant: string;
}

interface GA4Data {
  item_name: string;
  variations: Record<string, GA4Variation>;
  item_brand: string;
  item_category: string;
}

/**
 * Parse product data from a single NOW Foods category listing page HTML.
 * Extracts GA4 data attributes, product URLs, and image URLs.
 */
function parseProductsFromHtml(html: string): NowFoodsProduct[] {
  const products: NowFoodsProduct[] = [];

  // Extract GA4 product data
  const ga4Regex = /data-product-details-ga4="([^"]+)"/g;
  // Extract product URLs from about="" attribute on article elements
  const urlRegex = /about="(\/products\/[a-z0-9\/-]+)"/g;
  // Extract full image URLs from wishlist hidden inputs
  const imgRegex = /wishlist_variation_image_url[^"]*"[^"]*value="([^"]+)"/g;

  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(html)) !== null) urls.push(match[1]);

  const imgs: string[] = [];
  while ((match = imgRegex.exec(html)) !== null) imgs.push(match[1]);

  let i = 0;
  while ((match = ga4Regex.exec(html)) !== null) {
    const raw = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'");
    try {
      const data: GA4Data = JSON.parse(raw);
      const variants = Object.values(data.variations);
      const firstVariant = variants[0];
      if (!firstVariant) { i++; continue; }

      const price = parseFloat(firstVariant.price);
      if (isNaN(price) || price <= 0) { i++; continue; }

      products.push({
        name: data.item_name,
        url: urls[i] ? `${BASE_URL}${urls[i]}` : '',
        price,
        size: firstVariant.item_variant || '',
        imageUrl: imgs[i] || null,
        inStock: true,
      });
    } catch {
      // Skip unparseable products
    }
    i++;
  }

  return products;
}

/**
 * Fetch and parse all products from a single NOW Foods category path,
 * handling pagination automatically.
 */
export async function fetchNowFoodsCategory(path: string): Promise<{ products: NowFoodsProduct[]; errors: string[] }> {
  const products: NowFoodsProduct[] = [];
  const errors: string[] = [];

  for (let page = 0; page <= 10; page++) {
    try {
      const suffix = page > 0 ? `?page=${page}` : '';
      const url = `${BASE_URL}${path}${suffix}`;

      const response = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        if (page === 0) errors.push(`HTTP ${response.status} for ${path}`);
        break;
      }

      const html = await response.text();

      // Check for Cloudflare challenge
      if (html.includes('cf_chl') || html.includes('Just a moment')) {
        if (page === 0) errors.push(`Cloudflare challenge for ${path}`);
        break;
      }

      const pageProducts = parseProductsFromHtml(html);
      if (pageProducts.length === 0) break;

      products.push(...pageProducts);

      // Check if there's a next page link
      if (!html.includes(`page=${page + 1}`)) break;
    } catch (err: any) {
      if (page === 0) errors.push(`Fetch failed for ${path}: ${err.message}`);
      break;
    }
  }

  return { products, errors };
}
