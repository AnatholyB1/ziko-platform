/**
 * EAFIT HTML parser — scrapes products from www.eafit.com category pages.
 * EAFIT uses Magento, no public JSON API.
 * Each product listing page embeds individual JSON-LD Product blocks
 * with name, price, SKU, URL and image.
 */

export interface EafitProduct {
  name: string;
  sku: string;
  url: string;
  price: number | null;
  imageUrl: string | null;
  inStock: boolean;
}

const BASE_URL = 'https://www.eafit.com';

/**
 * Decode HTML entities in product names (Magento encodes them).
 * e.g. "Pure&#x20;Whey&#x20;Protein" → "Pure Whey Protein"
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Fetch all EAFIT products across paginated listing pages.
 * Pagination: /nos-produits.html?p=N (24 products per page, ~10 pages).
 */
export async function fetchAllEafitProducts(maxPages = 12): Promise<{
  products: EafitProduct[];
  errors: string[];
}> {
  const allProducts: EafitProduct[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1
        ? `${BASE_URL}/nos-produits.html`
        : `${BASE_URL}/nos-produits.html?p=${page}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        errors.push(`EAFIT HTTP ${response.status} for page ${page}`);
        break;
      }

      const html = await response.text();
      const pageProducts = parseJsonLdProducts(html);

      if (pageProducts.length === 0) break;

      for (const p of pageProducts) {
        if (!seen.has(p.sku)) {
          seen.add(p.sku);
          allProducts.push(p);
        }
      }

      // Less than a full page → no more pages
      if (pageProducts.length < 20) break;
    } catch (err: any) {
      errors.push(`EAFIT fetch failed page ${page}: ${err.message}`);
      break;
    }
  }

  return { products: allProducts, errors };
}

/**
 * Parse individual JSON-LD Product blocks from EAFIT HTML.
 * Magento embeds one <script type="application/ld+json"> per product in the listing.
 */
function parseJsonLdProducts(html: string): EafitProduct[] {
  const products: EafitProduct[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data['@type'] !== 'Product') continue;
      if (!data.name || !data.url) continue;

      const name = decodeHtmlEntities(data.name).trim();
      const sku = data.sku ? String(data.sku).trim() : '';
      if (!name || !sku) continue;

      const price = data.offers?.price != null
        ? parseFloat(String(data.offers.price))
        : null;

      const inStock = data.offers?.availability
        ? String(data.offers.availability).includes('InStock')
        : true;

      products.push({
        name,
        sku,
        url: data.url.startsWith('http') ? data.url : `${BASE_URL}${data.url}`,
        price,
        imageUrl: data.image || null,
        inStock,
      });
    } catch {
      // Skip malformed JSON-LD blocks
    }
  }

  return products;
}
