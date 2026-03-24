import type { BrandScraper, ScrapedProduct, ScraperResult } from '../types.js';
import { fetchScitecProducts } from '../utils/scitec-parser.js';
import { mapToCategory } from '../utils/category-mapper.js';
import { parseServingFromName } from '../utils/shopify.js';

export class ScitecScraper implements BrandScraper {
  brandSlug = 'scitec';
  brandName = 'Scitec Nutrition';

  async scrape(): Promise<ScraperResult> {
    const { products: rawProducts, errors } = await fetchScitecProducts();

    if (rawProducts.length === 0) {
      return {
        brandSlug: this.brandSlug,
        products: [],
        errors: [...errors, 'No products found from scitec.fr'],
      };
    }

    const scraped: ScrapedProduct[] = [];

    for (const product of rawProducts) {
      const categorySlug = mapToCategory('', [], product.categoryText);
      if (!categorySlug) continue;

      const nameServing = parseServingFromName(product.name);

      scraped.push({
        name: product.name,
        categorySlug,
        imageUrl: product.imageUrl,
        flavors: product.flavors.length ? product.flavors : undefined,
        sourceUrl: product.sourceUrl,
        price: product.price,
        currency: 'EUR',
        inStock: product.inStock,
        servingSize: nameServing.servingSize,
        servingsPerContainer: nameServing.servingsPerContainer,
      });
    }

    return { brandSlug: this.brandSlug, products: scraped, errors };
  }
}
