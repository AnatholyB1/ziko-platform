import type { BrandScraper, ScrapedProduct, ScraperResult } from '../types.js';
import { MYPROTEIN_CATEGORIES, fetchMyProteinCategory } from '../utils/myprotein-parser.js';
import { mapToCategory } from '../utils/category-mapper.js';
import { parseServingFromName } from '../utils/shopify.js';

export class MyProteinScraper implements BrandScraper {
  brandSlug = 'myprotein';
  brandName = 'MyProtein';

  async scrape(): Promise<ScraperResult> {
    const scraped: ScrapedProduct[] = [];
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const { url, categorySlug } of MYPROTEIN_CATEGORIES) {
      try {
        const { products, errors: catErrors } = await fetchMyProteinCategory(url, 2);
        errors.push(...catErrors);

        for (const product of products) {
          // Deduplicate across categories
          if (seen.has(product.productId)) continue;
          seen.add(product.productId);

          // Skip products without a price
          if (!product.price || product.price <= 0) continue;

          // Use title-based category when it overrides the page category
          const resolvedCategory = mapToCategory('', [], product.name) ?? categorySlug;
          const nameServing = parseServingFromName(product.name);

          scraped.push({
            name: product.name,
            categorySlug: resolvedCategory,
            imageUrl: product.imageUrl || undefined,
            sourceUrl: product.url,
            price: product.price,
            currency: 'EUR',
            inStock: true,
            servingSize: nameServing.servingSize,
            servingsPerContainer: nameServing.servingsPerContainer,
          });
        }
      } catch (err: any) {
        errors.push(`Category ${categorySlug} failed: ${err.message}`);
      }
    }

    return { brandSlug: this.brandSlug, products: scraped, errors };
  }
}
