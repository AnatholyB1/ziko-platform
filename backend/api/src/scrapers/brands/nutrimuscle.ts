/**
 * Nutrimuscle scraper — Shopify store
 * Dynamically fetches products from nutrimuscle.com/products.json
 */

import type { BrandScraper, ScrapedProduct, ScraperResult } from '../types.js';
import { fetchShopifyProducts, stripHtml, getCheapestVariant, extractFlavors } from '../utils/shopify.js';
import { mapToCategory } from '../utils/category-mapper.js';

/** Tags/types to exclude (clothing, accessories, bundles) */
const EXCLUDED_TAGS = ['accessoires', 'vêtements'];
const EXCLUDED_TYPES = ['autres', 'bundle'];

export class NutrimuscleScraper implements BrandScraper {
  brandSlug = 'nutrimuscle';
  brandName = 'Nutrimuscle';

  async scrape(): Promise<ScraperResult> {
    const { products, errors } = await fetchShopifyProducts('https://www.nutrimuscle.com');
    const scraped: ScrapedProduct[] = [];

    for (const product of products) {
      // Skip non-supplement products
      if (EXCLUDED_TYPES.includes(product.product_type.toLowerCase())) continue;
      if (product.tags.some(t => EXCLUDED_TAGS.includes(t.toLowerCase()))) continue;

      const categorySlug = mapToCategory(product.product_type, product.tags);
      if (!categorySlug) continue;

      const variant = getCheapestVariant(product.variants);
      if (!variant) continue;

      const flavors = extractFlavors(product.options);

      scraped.push({
        name: product.title,
        categorySlug,
        description: stripHtml(product.body_html || ''),
        imageUrl: product.images[0]?.src,
        sourceUrl: `https://www.nutrimuscle.com/products/${product.handle}`,
        price: parseFloat(variant.price),
        currency: 'EUR',
        inStock: product.variants.some(v => v.available),
        flavors: flavors.length > 0 ? flavors : undefined,
      });
    }

    return { brandSlug: this.brandSlug, products: scraped, errors };
  }
}
