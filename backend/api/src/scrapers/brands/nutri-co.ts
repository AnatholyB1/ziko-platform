import type { BrandScraper, ScrapedProduct, ScraperResult } from '../types.js';
import { fetchAllNutriCoProducts } from '../utils/nutrico-parser.js';
import { mapToCategory } from '../utils/category-mapper.js';
import { parseServingFromName } from '../utils/shopify.js';

export class NutriCoScraper implements BrandScraper {
  brandSlug = 'nutri-co';
  brandName = 'Nutri&Co';

  async scrape(): Promise<ScraperResult> {
    const { products, errors } = await fetchAllNutriCoProducts();
    const scraped: ScrapedProduct[] = [];

    for (const product of products) {
      // Skip packs — they bundle multiple products
      if (product.url.includes('/packs/')) continue;

      const categorySlug = mapToCategory('', [], product.name);
      if (!categorySlug) continue;

      if (!product.price || product.price <= 0) continue;

      const nameServing = parseServingFromName(product.name);

      scraped.push({
        name: product.name,
        categorySlug,
        description: product.description || undefined,
        imageUrl: product.imageUrl || undefined,
        sourceUrl: product.url,
        price: product.price,
        currency: 'EUR',
        inStock: true,
        servingSize: nameServing.servingSize,
        servingsPerContainer: nameServing.servingsPerContainer,
      });
    }

    return { brandSlug: this.brandSlug, products: scraped, errors };
  }
}
