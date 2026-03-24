/**
 * Applied Nutrition scraper — Shopify store
 * Dynamically fetches products from appliednutrition.uk/products.json
 */

import type { BrandScraper, ScrapedProduct, ScraperResult } from '../types.js';
import { fetchShopifyProducts, stripHtml, getCheapestVariant, extractFlavors, extractSize, parseServingFromHtml, parseServingFromName } from '../utils/shopify.js';
import { mapToCategory } from '../utils/category-mapper.js';

const EXCLUDED_TAGS = ['bogos-gift'];

export class AppliedNutritionScraper implements BrandScraper {
  brandSlug = 'applied-nutrition';
  brandName = 'Applied Nutrition';

  async scrape(): Promise<ScraperResult> {
    const { products, errors } = await fetchShopifyProducts('https://www.appliednutrition.uk');
    const scraped: ScrapedProduct[] = [];

    for (const product of products) {
      if (product.tags.some(t => EXCLUDED_TAGS.includes(t.toLowerCase()))) continue;
      if (parseFloat(product.variants[0]?.price ?? '0') === 0) continue;

      const categorySlug = mapToCategory(product.product_type, product.tags, product.title);
      if (!categorySlug) continue;

      const variant = getCheapestVariant(product.variants);
      if (!variant) continue;

      const flavors = extractFlavors(product.options);
      const size = extractSize(product.options, variant);
      const htmlServing = parseServingFromHtml(product.body_html || '');
      const nameServing = parseServingFromName(product.title);

      scraped.push({
        name: product.title,
        categorySlug,
        description: stripHtml(product.body_html || ''),
        imageUrl: product.images[0]?.src,
        sourceUrl: `https://www.appliednutrition.uk/products/${product.handle}`,
        price: parseFloat(variant.price),
        currency: 'GBP',
        inStock: product.variants.some(v => v.available),
        flavors: flavors.length > 0 ? flavors : undefined,
        servingSize: htmlServing.servingSize || size || nameServing.servingSize,
        servingsPerContainer: htmlServing.servingsPerContainer || nameServing.servingsPerContainer,
        nutritionPerServing: htmlServing.nutritionPerServing,
      });
    }

    return { brandSlug: this.brandSlug, products: scraped, errors };
  }
}
