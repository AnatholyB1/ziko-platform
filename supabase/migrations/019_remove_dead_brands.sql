-- ═══════════════════════════════════════════════════════════
-- 019 — Remove discontinued supplement brands + add write policies
-- 
-- Eric Favre: API returns HTTP 406, 0 products
-- Dymatize: No prices on website (brand showcase only)
-- BSN: Fetch fails, 0 products
-- Prozis: Removed from scraper
--
-- ON DELETE CASCADE on supplements → supplement_prices
-- removes all associated products and price history.
-- ═══════════════════════════════════════════════════════════

-- Add write policies for server-side operations (anon role used by backend)
CREATE POLICY "brands_anon_write" ON public.supplement_brands
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "supplements_anon_write" ON public.supplements
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "prices_anon_write" ON public.supplement_prices
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Remove dead brands (CASCADE deletes their supplements + prices)
DELETE FROM public.supplement_brands WHERE slug IN (
  'eric-favre',
  'dymatize',
  'bsn',
  'prozis'
);
