import type { BrandScraper, ScrapedProduct, ScraperResult } from '../types.js';
import { mapToCategory } from '../utils/category-mapper.js';
import { parseServingFromName } from '../utils/shopify.js';

const GRAPHQL_URL = 'https://www.bulk.com/graphql';
const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Store': 'default',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

const PRODUCTS_QUERY = `query($page: Int!) {
  products(search: "", pageSize: 50, currentPage: $page) {
    total_count
    items {
      name
      sku
      url_key
      categories { name }
      price_range {
        minimum_price {
          final_price { value currency }
          regular_price { value currency }
        }
      }
      image { url label }
      short_description { html }
      stock_status
    }
  }
}`;

interface GqlProduct {
  name: string;
  sku: string;
  url_key: string;
  categories: { name: string }[];
  price_range: {
    minimum_price: {
      final_price: { value: number; currency: string };
      regular_price: { value: number; currency: string };
    };
  };
  image: { url: string; label: string } | null;
  short_description: { html: string } | null;
  stock_status: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Categories that indicate non-supplement products (accessories, foods, etc.) */
const EXCLUDED_CATEGORIES = new Set([
  'gym accessories',
  'protein shakers & bottles',
  'empty capsules',
  'gym bags',
  'clothing',
  'apparel',
  'low calorie foods',
  'zero calorie foods',
  'konjac',
  'baking ingredients',
  'flavourings & sweeteners',
  'dried fruits',
  'nuts & seeds',
  'nut butters',
  'meat snacks',
  'bars & flapjacks',
  'cheat foods',
  'healthy oils',
]);

function isExcluded(categories: { name: string }[]): boolean {
  return categories.some(c => EXCLUDED_CATEGORIES.has(c.name.toLowerCase()));
}

export class BulkScraper implements BrandScraper {
  brandSlug = 'bulk';
  brandName = 'Bulk';

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const allProducts: GqlProduct[] = [];

    // Paginate through all products
    for (let page = 1; page <= 20; page++) {
      let data: any;
      try {
        const res = await fetch(GRAPHQL_URL, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({ query: PRODUCTS_QUERY, variables: { page } }),
        });
        if (!res.ok) {
          errors.push(`GraphQL page ${page} returned ${res.status}`);
          break;
        }
        data = await res.json();
      } catch (err: any) {
        errors.push(`GraphQL fetch failed on page ${page}: ${err.message}`);
        break;
      }

      const items = data?.data?.products?.items;
      if (!items || items.length === 0) break;
      allProducts.push(...items);

      if (allProducts.length >= (data.data.products.total_count ?? 0)) break;
    }

    if (allProducts.length === 0) {
      return { brandSlug: this.brandSlug, products: [], errors: [...errors, 'No products found via GraphQL'] };
    }

    const scraped: ScrapedProduct[] = [];

    for (const product of allProducts) {
      const categoryNames = product.categories?.map(c => c.name) ?? [];

      if (isExcluded(product.categories ?? [])) continue;

      const categorySlug = mapToCategory('', categoryNames, product.name);
      if (!categorySlug) continue;

      const price = product.price_range?.minimum_price?.final_price?.value;
      if (!price || price <= 0) continue;

      const description = product.short_description?.html
        ? stripHtml(product.short_description.html).slice(0, 500) || undefined
        : undefined;

      const nameServing = parseServingFromName(product.name);

      scraped.push({
        name: product.name,
        categorySlug,
        description,
        imageUrl: product.image?.url || undefined,
        sourceUrl: `https://www.bulk.com/products/${product.url_key}`,
        price,
        currency: product.price_range.minimum_price.final_price.currency || 'GBP',
        inStock: product.stock_status === 'IN_STOCK',
        servingSize: nameServing.servingSize,
        servingsPerContainer: nameServing.servingsPerContainer,
      });
    }

    return { brandSlug: this.brandSlug, products: scraped, errors };
  }
}
