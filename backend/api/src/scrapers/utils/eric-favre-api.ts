/**
 * Eric Favre custom API utility — their /products.json returns a proprietary
 * multilingual format (not Shopify).
 */

export interface EFProduct {
  id: string;
  name: { EN?: string; ES?: string; FR?: string };
  description?: { EN?: string; ES?: string; FR?: string };
  price: string;
  currency: string;
  availability: string;
  url?: { EN?: string; ES?: string; FR?: string };
  category: string;
  image?: string;
}

/**
 * Fetch products from Eric Favre's custom JSON API.
 * Returns raw EFProduct[] for further processing.
 */
export async function fetchEricFavreProducts(): Promise<{
  products: EFProduct[];
  errors: string[];
}> {
  const errors: string[] = [];
  let products: EFProduct[] = [];

  try {
    const response = await fetch('https://www.ericfavre.com/products.json', {
      headers: {
        'User-Agent': 'ZikoBot/1.0 (supplement-comparison)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      errors.push(`Eric Favre API returned HTTP ${response.status}`);
      return { products: [], errors };
    }

    const data: any = await response.json();
    if (Array.isArray(data)) {
      products = data;
    } else if (data?.products && Array.isArray(data.products)) {
      products = data.products;
    }
  } catch (err: any) {
    errors.push(`Eric Favre fetch failed: ${err.message}`);
  }

  return { products, errors };
}

/**
 * Group Eric Favre product variants by base product name,
 * keeping only the cheapest variant and collecting all unique names.
 */
export function deduplicateEFProducts(products: EFProduct[]): EFProduct[] {
  const grouped = new Map<string, EFProduct>();

  for (const product of products) {
    const name = product.name?.FR || product.name?.EN || '';
    if (!name) continue;

    const existing = grouped.get(name);
    if (!existing || parseFloat(product.price) < parseFloat(existing.price)) {
      grouped.set(name, product);
    }
  }

  return Array.from(grouped.values());
}
