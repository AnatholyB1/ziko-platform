/**
 * Category mapper — maps product types and tags from various stores
 * to our supplement_categories slugs.
 *
 * IMPORTANT: Order matters! Specific categories MUST come before broad ones.
 * e.g. 'collagen' before 'protein', 'omega' before 'vitamins'.
 * The first match wins.
 */

/** Categories ordered from most-specific to least-specific */
const CATEGORY_KEYWORDS: [string, string[]][] = [
  // ── Specific categories first ──
  ['collagen', [
    'collagène', 'collagene', 'collagen', 'peptan',
  ]],
  ['creatine', [
    'créatine', 'creatine', 'creapure',
  ]],
  ['omega', [
    'omega', 'oméga', 'huile de poisson', 'fish oil', 'epa', 'dha',
    'krill oil', 'cod liver oil',
  ]],
  ['gainer', [
    'gainer', 'gainers', 'mass gainer', 'prise de masse', 'weight gainer',
    'serious mass',
  ]],
  ['joints', [
    'articulation', 'articulations', 'joints', 'joint support', 'joint restore',
    'joint care', 'joint comfort', 'glucosamine', 'chondroïtine', 'chondroitine',
    'chondroitin', 'cissus',
  ]],
  ['sleep-recovery', [
    'sommeil', 'sleep', 'récupération', 'mélatonine', 'melatonine',
    'melatonin', 'zma',
  ]],
  ['fat-burner', [
    'brûleur', 'bruleur', 'fat burner', 'fat-burner', 'thermogénique',
    'thermogenique', 'thermogenic', 'minceur', 'détox', 'detox',
    'cla', 'conjugated linoleic', 'glucomannan',
    'raspberry ketone', 'green tea extract', 'cutting edge',
    'l-carnitine', 'carnitine',
  ]],
  ['greens', [
    'greens', 'super greens', 'supergreens', 'greens powder', 'critical greens',
    'complete greens',
  ]],
  ['bcaa-eaa', [
    'bcaa', 'eaa', 'acides aminés', 'acides amines', 'amino acid', 'amino acids',
    'aminoacid', 'leucine', 'glutamine',
  ]],
  ['pre-workout', [
    'pre-workout', 'pre workout', 'pre-work-out', 'preworkout', 'booster',
    'pre-work out', 'pre work out',
  ]],
  // ── Broad categories last ──
  ['protein', [
    'protein', 'protéine', 'protéines', 'proteines', 'whey', 'isolate',
    'caséine', 'casein', 'isolat',
  ]],
  ['vitamins', [
    'vitamine', 'vitamines', 'vitamin', 'vitamins', 'multivitamin', 'multivitamines',
    'mineral', 'minéraux', 'mineraux', 'zinc', 'magnesium', 'magnésium',
    'bien-être', 'well-being', 'wellbeing',
  ]],
];

/** Product name patterns that should always be excluded (not supplements) */
const EXCLUDED_NAME_PATTERNS = [
  'shaker', 'bottle', 'bag', 'belt', 'pad', 'sleeve', 'towel', 'glove',
  't-shirt', 'tank top', 'hoodie', 'legging', 'shorts',
  'gym bag', 'water bottle',
];

/**
 * Map a product type string and/or array of tags to our category slug.
 * Optionally checks the product title as well (useful for stores like ON
 * that use generic product_type values like "Consumable").
 * Returns null if no category matched — the product should be skipped.
 */
export function mapToCategory(productType: string, tags: string[] = [], title?: string): string | null {
  const titleLower = title?.toLowerCase().trim() ?? '';

  // Exclude non-supplement products by name
  if (titleLower && EXCLUDED_NAME_PATTERNS.some(p => titleLower.includes(p))) {
    return null;
  }

  const tagInputs = [
    productType.toLowerCase().trim(),
    ...tags.map(t => t.toLowerCase().trim()),
  ].filter(Boolean);

  // Pass 1: check title first — gives priority to what the product actually IS
  if (titleLower) {
    for (const [slug, keywords] of CATEGORY_KEYWORDS) {
      for (const keyword of keywords) {
        if (titleLower === keyword || titleLower.includes(keyword)) {
          return slug;
        }
      }
    }
  }

  // Pass 2: fall back to product type + tags
  for (const [slug, keywords] of CATEGORY_KEYWORDS) {
    for (const input of tagInputs) {
      for (const keyword of keywords) {
        if (input === keyword || input.includes(keyword)) {
          return slug;
        }
      }
    }
  }

  return null;
}
