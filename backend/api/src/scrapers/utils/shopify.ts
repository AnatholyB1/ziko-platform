/**
 * Shopify JSON API utility — fetches products from any Shopify store
 * via their public /products.json endpoint.
 */

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  product_type: string;
  tags: string[];
  vendor: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  options: ShopifyOption[];
}

export interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  available: boolean;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

export interface ShopifyImage {
  id: number;
  src: string;
  position: number;
}

export interface ShopifyOption {
  name: string;
  values: string[];
}

/**
 * Fetch products from a Shopify store's public JSON API.
 * Paginates to get up to maxPages * 250 products.
 */
export async function fetchShopifyProducts(
  storeUrl: string,
  maxPages = 2,
): Promise<{ products: ShopifyProduct[]; errors: string[] }> {
  const products: ShopifyProduct[] = [];
  const errors: string[] = [];
  const baseUrl = storeUrl.replace(/\/+$/, '');

  try {
    for (let page = 1; page <= maxPages; page++) {
      const url = `${baseUrl}/products.json?limit=250&page=${page}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ZikoBot/1.0 (supplement-comparison)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        if (page === 1) {
          errors.push(`Shopify API returned HTTP ${response.status}`);
        }
        break;
      }

      const data = await response.json() as { products?: ShopifyProduct[] };
      if (!data?.products?.length) break;

      products.push(...data.products);

      // If fewer than 250, we've reached the last page
      if (data.products.length < 250) break;
    }
  } catch (err: any) {
    errors.push(`Shopify fetch failed: ${err.message}`);
  }

  return { products, errors };
}

/** Strip HTML tags and decode common entities */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Extract cheapest available variant, or first variant as fallback */
export function getCheapestVariant(variants: ShopifyVariant[]): ShopifyVariant | undefined {
  const available = variants.filter(v => v.available);
  const pool = available.length > 0 ? available : variants;
  return pool.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
}

/** Extract flavor/saveur option values from a Shopify product */
export function extractFlavors(options: ShopifyOption[]): string[] {
  const flavorOption = options.find(o => {
    const name = o.name.toLowerCase();
    return name.includes('saveur') || name.includes('flavor') || name.includes('flavour')
      || name.includes('goût') || name.includes('gout');
  });
  return flavorOption?.values ?? [];
}
