import type { BrandScraper, ScrapedProduct, ScraperResult } from '../types.js';
import { fetchAllEafitProducts } from '../utils/eafit-parser.js';
import { mapToCategory } from '../utils/category-mapper.js';

export class EafitScraper implements BrandScraper {
  brandSlug = 'eafit';
  brandName = 'Eafit';

  async scrape(): Promise<ScraperResult> {
    const { products, errors } = await fetchAllEafitProducts();
    const scraped: ScrapedProduct[] = [];

    for (const product of products) {
      const categorySlug = mapToCategory('', [], product.name);
      if (!categorySlug) continue;

      if (!product.price || product.price <= 0) continue;

      scraped.push({
        name: product.name,
        categorySlug,
        imageUrl: product.imageUrl || undefined,
        sourceUrl: product.url,
        price: product.price,
        currency: 'EUR',
        inStock: product.inStock,
      });
    }

    return { brandSlug: this.brandSlug, products: scraped, errors };
  }
}
