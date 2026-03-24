/**
 * Scraper Registry — orchestrates all brand scrapers
 *
 * Add new brand scrapers by importing them and adding to SCRAPERS array.
 * The cron job calls runAllScrapers() weekly (Monday 3 AM UTC).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BrandScraper, ScrapedProduct, ScraperResult } from './types.js';
import { NutrimuscleScraper } from './brands/nutrimuscle.js';
import { MyProteinScraper } from './brands/myprotein.js';
import { OptimumNutritionScraper } from './brands/optimum-nutrition.js';
import { EafitScraper } from './brands/eafit.js';
import { NutriCoScraper } from './brands/nutri-co.js';
import { NowFoodsScraper } from './brands/now-foods.js';
import { ScitecScraper } from './brands/scitec.js';
import { BioTechUSAScraper } from './brands/biotech-usa.js';
import { MuscleTechScraper } from './brands/muscletech.js';
import { AppliedNutritionScraper } from './brands/applied-nutrition.js';
import { BulkScraper } from './brands/bulk.js';

// ── Registered scrapers ──────────────────────────────────
const SCRAPERS: BrandScraper[] = [
  new NutrimuscleScraper(),
  new MyProteinScraper(),
  new OptimumNutritionScraper(),
  new EafitScraper(),
  new NutriCoScraper(),
  new NowFoodsScraper(),
  new ScitecScraper(),
  new BioTechUSAScraper(),
  new MuscleTechScraper(),
  new AppliedNutritionScraper(),
  new BulkScraper(),
];

interface ScrapeRunResult {
  brand: string;
  productsProcessed: number;
  pricesInserted: number;
  errors: string[];
}

/** Run all registered scrapers, upsert products & insert prices */
export async function runAllScrapers(supabase: SupabaseClient): Promise<ScrapeRunResult[]> {
  const results: ScrapeRunResult[] = [];

  for (const scraper of SCRAPERS) {
    const runResult: ScrapeRunResult = {
      brand: scraper.brandSlug,
      productsProcessed: 0,
      pricesInserted: 0,
      errors: [],
    };

    try {
      console.log(`[Scraper] Starting ${scraper.brandName}...`);
      const scraperResult = await scraper.scrape();
      runResult.errors.push(...scraperResult.errors);

      // Resolve brand ID
      const { data: brand } = await supabase
        .from('supplement_brands')
        .select('id')
        .eq('slug', scraper.brandSlug)
        .single();

      if (!brand) {
        runResult.errors.push(`Brand not found: ${scraper.brandSlug}`);
        results.push(runResult);
        continue;
      }

      for (const product of scraperResult.products) {
        try {
          // Resolve category
          const { data: category } = await supabase
            .from('supplement_categories')
            .select('id')
            .eq('slug', product.categorySlug)
            .single();

          if (!category) {
            runResult.errors.push(`Category not found: ${product.categorySlug} for ${product.name}`);
            continue;
          }

          // Generate slug from product name
          const slug = product.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          // Upsert supplement
          const { data: supp, error: suppErr } = await supabase
            .from('supplements')
            .upsert({
              brand_id: brand.id,
              category_id: category.id,
              name: product.name,
              slug,
              description: product.description ?? null,
              image_url: product.imageUrl ?? null,
              ingredients: product.ingredients ?? null,
              nutrition_per_serving: product.nutritionPerServing ?? null,
              serving_size: product.servingSize ?? null,
              servings_per_container: product.servingsPerContainer ?? null,
              flavors: product.flavors ?? null,
              source_url: product.sourceUrl,
              last_scraped_at: new Date().toISOString(),
            }, {
              onConflict: 'brand_id,slug',
            })
            .select('id')
            .single();

          if (suppErr || !supp) {
            runResult.errors.push(`Failed to upsert: ${product.name} — ${suppErr?.message}`);
            continue;
          }

          runResult.productsProcessed++;

          // Insert price point only if price changed from latest
          const pricePerServing = product.servingsPerContainer && product.servingsPerContainer > 0
            ? product.price / product.servingsPerContainer
            : null;

          const { data: lastPrice } = await supabase
            .from('supplement_prices')
            .select('price, currency, in_stock')
            .eq('supplement_id', supp.id)
            .eq('source', scraper.brandName)
            .order('scraped_at', { ascending: false })
            .limit(1)
            .single();

          const currentCurrency = product.currency ?? 'EUR';
          const currentInStock = product.inStock ?? true;
          const priceChanged = !lastPrice
            || lastPrice.price !== product.price
            || lastPrice.currency !== currentCurrency
            || lastPrice.in_stock !== currentInStock;

          if (priceChanged) {
            const { error: priceErr } = await supabase
              .from('supplement_prices')
              .insert({
                supplement_id: supp.id,
                price: product.price,
                currency: currentCurrency,
                source: scraper.brandName,
                source_url: product.sourceUrl,
                in_stock: currentInStock,
                price_per_serving: pricePerServing,
              });

            if (priceErr) {
              runResult.errors.push(`Price insert failed for ${product.name}: ${priceErr.message}`);
            } else {
              runResult.pricesInserted++;
            }
          }
        } catch (err: any) {
          runResult.errors.push(`Product error (${product.name}): ${err.message}`);
        }
      }

      console.log(`[Scraper] ${scraper.brandName}: ${runResult.productsProcessed} products, ${runResult.pricesInserted} prices`);
    } catch (err: any) {
      runResult.errors.push(`Scraper failed: ${err.message}`);
      console.error(`[Scraper] ${scraper.brandName} failed:`, err);
    }

    results.push(runResult);
  }

  return results;
}
