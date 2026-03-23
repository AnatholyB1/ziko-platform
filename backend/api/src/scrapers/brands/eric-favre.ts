/**
 * Eric Favre scraper — custom JSON API (not Shopify)
 * Dynamically fetches products from ericfavre.com/products.json
 */

import type { BrandScraper, ScrapedProduct, ScraperResult } from '../types.js';
import { fetchEricFavreProducts, deduplicateEFProducts } from '../utils/eric-favre-api.js';
import { mapEricFavreCategory } from '../utils/category-mapper.js';

/** Eric Favre categories that are NOT supplements */
const EXCLUDED_CATEGORIES = [
  'man', 'woman', 'samples', 'fitness bodybuilding', 'offered products',
  'stormix', 'cooking', 'accessories',
];

export class EricFavreScraper implements BrandScraper {
  brandSlug = 'eric-favre';
  brandName = 'Eric Favre';

  async scrape(): Promise<ScraperResult> {
    const { products: rawProducts, errors } = await fetchEricFavreProducts();

    // Filter supplement categories only
    const supplementProducts = rawProducts.filter(p => {
      const cat = p.category?.toLowerCase().trim() ?? '';
      return cat && !EXCLUDED_CATEGORIES.includes(cat);
    });

    // Deduplicate variants (same product name → keep cheapest)
    const deduped = deduplicateEFProducts(supplementProducts);
    const scraped: ScrapedProduct[] = [];

    for (const product of deduped) {
      const categorySlug = mapEricFavreCategory(product.category);
      if (!categorySlug) continue;

      const name = product.name?.FR || product.name?.EN || '';
      if (!name) continue;

      const price = parseFloat(product.price);
      if (isNaN(price) || price <= 0) continue;

      const sourceUrl = product.url?.FR || product.url?.EN || 'https://www.ericfavre.com';
      const description = product.description?.FR || product.description?.EN || '';
      // Strip basic HTML from description
      const cleanDescription = description
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      scraped.push({
        name,
        categorySlug,
        description: cleanDescription || undefined,
        sourceUrl,
        price,
        currency: product.currency || 'EUR',
        inStock: product.availability === 'in_stock',
      });
    }

    return { brandSlug: this.brandSlug, products: scraped, errors };
  }
}
