import type { BrandScraper, ScrapedProduct, ScraperResult } from '../types.js';
import { fetchShopifyProducts, stripHtml, getCheapestVariant, extractFlavors, extractSize, parseServingFromHtml, parseServingFromName } from '../utils/shopify.js';
import { mapToCategory } from '../utils/category-mapper.js';

export class MuscleTechScraper implements BrandScraper {
  brandSlug = 'muscletech';
  brandName = 'MuscleTech';

  async scrape(): Promise<ScraperResult> {
    const { products: rawProducts, errors } = await fetchShopifyProducts('https://www.muscletech.com');

    if (rawProducts.length === 0) {
      return { brandSlug: this.brandSlug, products: [], errors: [...errors, 'No products found — store may not be Shopify-based'] };
    }

    const scraped: ScrapedProduct[] = [];

    for (const product of rawProducts) {
      const categorySlug = mapToCategory(product.product_type, product.tags, product.title);
      if (!categorySlug) continue;

      const variant = getCheapestVariant(product.variants);
      if (!variant) continue;

      const price = parseFloat(variant.price);
      if (isNaN(price) || price <= 0) continue;

      const flavors = extractFlavors(product.options);
      const size = extractSize(product.options, variant);
      const htmlServing = parseServingFromHtml(product.body_html || '');
      const nameServing = parseServingFromName(product.title);

      scraped.push({
        name: product.title,
        categorySlug,
        description: product.body_html ? stripHtml(product.body_html).slice(0, 500) || undefined : undefined,
        imageUrl: product.images?.[0]?.src,
        flavors,
        sourceUrl: `https://www.muscletech.com/products/${product.handle}`,
        price,
        currency: 'USD',
        inStock: variant.available ?? true,
        servingSize: htmlServing.servingSize || size || nameServing.servingSize,
        servingsPerContainer: htmlServing.servingsPerContainer || nameServing.servingsPerContainer,
        nutritionPerServing: htmlServing.nutritionPerServing,
      });
    }

    return { brandSlug: this.brandSlug, products: scraped, errors };
  }
}
