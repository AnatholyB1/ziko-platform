import type { PluginManifest } from '@ziko/plugin-sdk';

const pantryManifest: PluginManifest = {
  id: 'pantry',
  name: 'Garde-Manger',
  version: '1.0.0',
  description:
    'Inventaire intelligent de votre cuisine : suivez vos stocks, dates d\'expiration, et recevez des suggestions de recettes IA basées sur ce que vous avez.',
  icon: 'storefront-outline',
  category: 'nutrition',
  price: 'free',
  requiredPermissions: ['read_profile'],
  userDataKeys: ['pantry'],

  aiSkills: [
    {
      name: 'pantry_management',
      description: 'Manage pantry inventory and suggest recipes based on available ingredients',
      triggerKeywords: [
        'garde-manger', 'frigo', 'stock', 'pantry', 'ingredients', 'ingrediens', 'aliments',
        'recette', 'recipe', 'cuisiner', 'cook', 'frigidaire', 'congelateur', 'freezer',
      ],
      contextProvider: () => ({ skill: 'pantry_management' }),
    },
  ],

  aiTools: [
    {
      name: 'pantry_get_items',
      description: 'Get the list of pantry items for the current user. Optionally filter by storage location.',
      parameters: {
        type: 'object',
        properties: {
          storage_location: {
            type: 'string',
            enum: ['fridge', 'freezer', 'pantry'],
            description: 'Filter by storage location (optional)',
          },
          food_category: {
            type: 'string',
            enum: ['fruits', 'vegetables', 'meat', 'fish_seafood', 'dairy', 'eggs', 'grains_pasta', 'snacks', 'drinks', 'other'],
            description: 'Filter by food category (optional)',
          },
        },
        required: [],
      },
    },
    {
      name: 'pantry_update_item',
      description: 'Update a pantry item quantity (e.g. after cooking or shopping).',
      parameters: {
        type: 'object',
        properties: {
          item_id: {
            type: 'string',
            description: 'UUID of the pantry item to update',
          },
          quantity: {
            type: 'number',
            description: 'New quantity value',
          },
        },
        required: ['item_id', 'quantity'],
      },
    },
  ],

  aiSystemPromptAddition: `
## Garde-Manger Plugin
You can access the user's pantry inventory. Use this to:
- Suggest recipes based on available ingredients
- Warn about items nearing expiration
- Help plan meals that minimize food waste
- Track low-stock items that need restocking
Storage locations: fridge, freezer, pantry.
Units: g, kg, ml, L, pieces, can, box, bag.
`,

  routes: [
    {
      path: '/(plugins)/pantry/dashboard',
      title: 'Garde-Manger',
      icon: 'storefront-outline',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/pantry/add',
      title: 'Ajouter un aliment',
      icon: 'add-circle-outline',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/pantry/edit',
      title: 'Modifier un aliment',
      icon: 'create-outline',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/pantry/recipes',
      title: 'Recettes IA',
      icon: 'restaurant-outline',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/pantry/recipe-detail',
      title: 'Détail recette',
      icon: 'book-outline',
      showInTabBar: false,
    },
  ],
};

export default pantryManifest;
