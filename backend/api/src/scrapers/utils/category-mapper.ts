/**
 * Category mapper — maps product types and tags from various stores
 * to our supplement_categories slugs.
 */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'protein': [
    'protein', 'protéine', 'protéines', 'proteines', 'whey', 'isolate',
    'caséine', 'casein', 'isolat',
  ],
  'creatine': [
    'créatine', 'creatine', 'creapure',
  ],
  'bcaa-eaa': [
    'bcaa', 'eaa', 'acides aminés', 'acides amines', 'amino acid', 'amino acids',
    'aminoacid', 'leucine', 'glutamine',
  ],
  'pre-workout': [
    'pre-workout', 'pre workout', 'pre-work-out', 'preworkout', 'booster',
    'pre-work out', 'pre work out',
  ],
  'vitamins': [
    'vitamine', 'vitamines', 'vitamin', 'vitamins', 'multivitamin', 'multivitamines',
    'mineral', 'minéraux', 'mineraux', 'zinc', 'magnesium', 'magnésium',
    'bien-être', 'well-being', 'wellbeing', 'greens', 'super green',
  ],
  'omega': [
    'omega', 'oméga', 'huile de poisson', 'fish oil', 'epa', 'dha',
  ],
  'collagen': [
    'collagène', 'collagene', 'collagen', 'peptan',
  ],
  'gainer': [
    'gainer', 'gainers', 'mass gainer', 'prise de masse', 'weight gainer',
  ],
  'fat-burner': [
    'brûleur', 'bruleur', 'fat burner', 'fat-burner', 'thermogénique',
    'thermogenique', 'perte de poids', 'weight loss', 'minceur', 'détox', 'detox',
  ],
  'joints': [
    'articulation', 'articulations', 'joints', 'joint', 'glucosamine',
    'chondroïtine', 'chondroitine',
  ],
  'sleep-recovery': [
    'sommeil', 'sleep', 'récupération', 'recovery', 'mélatonine', 'melatonine',
    'melatonin', 'zma',
  ],
  'greens': [
    'super greens', 'supergreens', 'greens powder',
  ],
};

/**
 * Map a product type string and/or array of tags to our category slug.
 * Optionally checks the product title as well (useful for stores like ON
 * that use generic product_type values like "Consumable").
 * Returns null if no category matched — the product should be skipped.
 */
export function mapToCategory(productType: string, tags: string[] = [], title?: string): string | null {
  const inputs = [
    productType.toLowerCase().trim(),
    ...tags.map(t => t.toLowerCase().trim()),
    ...(title ? [title.toLowerCase().trim()] : []),
  ].filter(Boolean);

  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const input of inputs) {
      for (const keyword of keywords) {
        if (input === keyword || input.includes(keyword)) {
          return slug;
        }
      }
    }
  }

  return null;
}

/**
 * Map Eric Favre API category strings to our category slugs.
 */
const EF_CATEGORY_MAP: Record<string, string> = {
  'proteins': 'protein',
  'boosters & pre work out': 'pre-workout',
  'gainers': 'gainer',
  'bcaa & amino acids': 'bcaa-eaa',
  'collagen': 'collagen',
  'detox & weight loss': 'fat-burner',
  'general well-being': 'vitamins',
  'joint comfort & relaxants': 'joints',
  'endurance & performance': 'pre-workout',
  'sportdiet': 'protein',
};

/** Eric Favre-specific category mapping */
export function mapEricFavreCategory(category: string): string | null {
  return EF_CATEGORY_MAP[category.toLowerCase().trim()] ?? null;
}
