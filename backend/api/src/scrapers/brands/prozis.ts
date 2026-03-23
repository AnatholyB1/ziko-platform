import type { BrandScraper, ScrapedProduct, ScraperResult } from '../types.js';
import { fetchShopifyProducts, stripHtml, getCheapestVariant, extractFlavors } from '../utils/shopify.js';
import { mapToCategory } from '../utils/category-mapper.js';

export class ProzisScraper implements BrandScraper {
  brandSlug = 'prozis';
  brandName = 'Prozis';

  async scrape(): Promise<ScraperResult> {
    const { products: rawProducts, errors } = await fetchShopifyProducts('https://www.prozis.com');

    if (rawProducts.length === 0) {
      return { brandSlug: this.brandSlug, products: [], errors: [...errors, 'No products found — store may not be Shopify-based'] };
    }

    const scraped: ScrapedProduct[] = [];

    for (const product of rawProducts) {
      const categorySlug = mapToCategory(product.product_type, product.tags);
      if (!categorySlug) continue;

      const variant = getCheapestVariant(product.variants);
      if (!variant) continue;

      const price = parseFloat(variant.price);
      if (isNaN(price) || price <= 0) continue;

      scraped.push({
        name: product.title,
        categorySlug,
        description: product.body_html ? stripHtml(product.body_html).slice(0, 500) || undefined : undefined,
        imageUrl: product.images?.[0]?.src,
        flavors: extractFlavors(product.options),
        sourceUrl: `https://www.prozis.com/products/${product.handle}`,
        price,
        currency: 'EUR',
        inStock: variant.available ?? true,
      });
    }

    return { brandSlug: this.brandSlug, products: scraped, errors };
  }
}
