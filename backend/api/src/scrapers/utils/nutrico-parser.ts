/**
 * Nutri&Co HTML parser — scrapes products from nutriandco.com.
 * Nutri&Co uses PrestaShop. The product listing page embeds a single JSON-LD
 * @graph containing an ItemList with all products (name, price, URL, image).
 * Raw newlines appear inside JSON string values and must be escaped before parsing.
 */

export interface NutriCoProduct {
  name: string;
  slug: string;
  url: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  description: string | null;
}

/**
 * Fetch all Nutri&Co products from their listing page.
 * All products are on a single page — no pagination needed.
 */
export async function fetchAllNutriCoProducts(): Promise<{
  products: NutriCoProduct[];
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const response = await fetch('https://nutriandco.com/fr/produits', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      errors.push(`Nutri&Co HTTP ${response.status}`);
      return { products: [], errors };
    }

    const html = await response.text();
    const products = parseJsonLdProducts(html);

    if (products.length === 0) {
      errors.push('No JSON-LD products found on nutriandco.com');
    }

    return { products, errors };
  } catch (err: any) {
    errors.push(`Nutri&Co fetch failed: ${err.message}`);
    return { products: [], errors };
  }
}

/**
 * Parse JSON-LD @graph → ItemList → Product entries from Nutri&Co HTML.
 * PrestaShop embeds raw newlines in description strings which must be
 * escaped before JSON.parse can handle them.
 */
function parseJsonLdProducts(html: string): NutriCoProduct[] {
  const scripts = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)
    || html.match(/<script[^>]*>([\s\S]*?)<\/script>/g)
    || [];

  for (const scriptTag of scripts) {
    if (!scriptTag.includes('ItemList')) continue;

    let content = scriptTag
      .replace(/<script[^>]*>/, '')
      .replace(/<\/script>/, '')
      .trim();

    // Escape raw newlines/tabs/returns inside JSON string values.
    // PrestaShop descriptions contain literal line breaks which break JSON.parse.
    content = content.replace(/"([^"\\]|\\.)*"/g, (match: string) => {
      return match
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    });

    try {
      const data = JSON.parse(content);
      const graph: any[] = data['@graph'];
      if (!Array.isArray(graph)) continue;

      const itemList = graph.find((node: any) => node['@type'] === 'ItemList');
      if (!itemList?.itemListElement?.length) continue;

      const products: NutriCoProduct[] = [];

      for (const el of itemList.itemListElement) {
        const item = el.item || el;
        if (item['@type'] !== 'Product') continue;
        if (!item.name || !item.url) continue;

        const url = item.url as string;
        // Extract slug from URL: /fr/produits/{slug} or /fr/packs/{slug}
        const slug = url.split('/').filter(Boolean).pop() ?? '';

        const price = item.offers?.price != null
          ? parseFloat(String(item.offers.price))
          : null;

        let imageUrl = item.image ? String(item.image) : null;
        // Fix relative image URLs
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `https://${imageUrl}`;
        }

        products.push({
          name: String(item.name).trim(),
          slug,
          url: url.startsWith('http') ? url : `https://nutriandco.com${url}`,
          price,
          currency: item.offers?.priceCurrency ?? 'EUR',
          imageUrl,
          description: item.description
            ? String(item.description).replace(/\\n/g, ' ').trim().slice(0, 500) || null
            : null,
        });
      }

      return products;
    } catch {
      continue;
    }
  }

  return [];
}
