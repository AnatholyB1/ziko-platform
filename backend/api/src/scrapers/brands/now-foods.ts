import type { BrandScraper, ScrapedProduct, ScraperResult } from '../types.js';
import { NOWFOODS_CATEGORIES, fetchNowFoodsCategory } from '../utils/nowfoods-parser.js';
import { mapToCategory } from '../utils/category-mapper.js';
import { parseServingFromName } from '../utils/shopify.js';

export class NowFoodsScraper implements BrandScraper {
  brandSlug = 'now-foods';
  brandName = 'NOW Foods';

  async scrape(): Promise<ScraperResult> {
    const scraped: ScrapedProduct[] = [];
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const { path, categorySlug } of NOWFOODS_CATEGORIES) {
      const { products, errors: catErrors } = await fetchNowFoodsCategory(path);
      errors.push(...catErrors);

      for (const product of products) {
        // Deduplicate by name (products appear in multiple categories)
        if (seen.has(product.name)) continue;
        seen.add(product.name);

        // Use category-mapper for finer-grained categorization (e.g. creatine vs pre-workout
        // within the energy-production page), falling back to the page-level category
        const resolvedCategory = mapToCategory('', [], product.name) ?? categorySlug;
        const nameServing = parseServingFromName(product.name);

        scraped.push({
          name: product.name,
          categorySlug: resolvedCategory,
          imageUrl: product.imageUrl || undefined,
          sourceUrl: product.url,
          price: product.price,
          currency: 'USD',
          inStock: product.inStock,
          servingSize: product.size || nameServing.servingSize,
          servingsPerContainer: nameServing.servingsPerContainer,
        });
      }
    }

    if (scraped.length === 0 && errors.length === 0) {
      errors.push('No products found — Cloudflare may be blocking requests');
    }

    return { brandSlug: this.brandSlug, products: scraped, errors };
  }
}
