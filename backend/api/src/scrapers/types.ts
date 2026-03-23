/**
 * Scraper Types — supplement price scraping framework
 */

export interface ScrapedProduct {
  /** Product name */
  name: string;
  /** Category slug from supplement_categories */
  categorySlug: string;
  /** Description */
  description?: string;
  /** Product image URL */
  imageUrl?: string;
  /** Ingredient list as text */
  ingredients?: string;
  /** Nutrition facts per serving — flexible JSONB */
  nutritionPerServing?: Record<string, number>;
  /** e.g. "30g", "1 scoop (25g)" */
  servingSize?: string;
  /** Number of servings in the container */
  servingsPerContainer?: number;
  /** Available flavors */
  flavors?: string[];
  /** Source product page URL */
  sourceUrl: string;
  /** Current price */
  price: number;
  /** Currency code */
  currency?: string;
  /** Whether the product is in stock */
  inStock?: boolean;
}

export interface ScraperResult {
  brandSlug: string;
  products: ScrapedProduct[];
  errors: string[];
}

/**
 * A brand scraper must implement this interface.
 * Each scraper is responsible for fetching products from one brand's website/API.
 */
export interface BrandScraper {
  /** Brand slug — must match supplement_brands.slug */
  brandSlug: string;
  /** Human-readable brand name */
  brandName: string;
  /** Scrape products and return results */
  scrape(): Promise<ScraperResult>;
}
