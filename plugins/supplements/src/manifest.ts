import type { PluginManifest } from '@ziko/plugin-sdk';

const supplementsManifest: PluginManifest = {
  id: 'supplements',
  name: 'Compléments Alimentaires',
  version: '1.0.0',
  description:
    'Catalogue complet de compléments alimentaires : compare les prix, les ingrédients et trouve les meilleurs produits pour tes objectifs.',
  icon: 'flask',
  category: 'nutrition',
  price: 'free',
  requiredPermissions: ['read_profile'],
  userDataKeys: ['supplements'],

  routes: [
    {
      path: '/(plugins)/supplements/list',
      title: 'Compléments',
      icon: 'flask',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/supplements/detail',
      title: 'Détail',
      icon: 'flask',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/supplements/compare',
      title: 'Comparateur',
      icon: 'git-compare',
      showInTabBar: false,
    },
  ],

  aiSkills: [
    {
      name: 'supplement_recommendation',
      description: 'Recommend supplements based on user goals, diet, and training',
      triggerKeywords: [
        'supplement', 'complément', 'whey', 'créatine', 'creatine', 'protéine', 'protein powder',
        'bcaa', 'vitamines', 'omega', 'pre-workout', 'collagène', 'magnésium',
      ],
      contextProvider: () => ({ skill: 'supplement_recommendation' }),
    },
    {
      name: 'supplement_comparison',
      description: 'Compare supplement products by price, ingredients, and value',
      triggerKeywords: ['compare supplements', 'comparer compléments', 'meilleur whey', 'best creatine', 'quel complément'],
      contextProvider: () => ({ skill: 'supplement_comparison' }),
    },
  ],

  aiTools: [
    {
      name: 'supplements_search',
      description: 'Search the supplements catalog by name, category, or brand',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (product name, ingredient, etc.)' },
          category: { type: 'string', description: 'Category slug (protein, creatine, bcaa-eaa, vitamins, etc.)' },
          brand: { type: 'string', description: 'Brand slug (myprotein, optimum-nutrition, nutrimuscle, etc.)' },
        },
      },
    },
    {
      name: 'supplements_compare_prices',
      description: 'Compare prices across sources for a specific supplement or category',
      parameters: {
        type: 'object',
        properties: {
          supplement_id: { type: 'string', description: 'UUID of the supplement to get prices for' },
          category: { type: 'string', description: 'Category slug to compare best prices across brands' },
        },
      },
    },
    {
      name: 'supplements_recommend',
      description: 'Get AI supplement recommendations based on user goals and dietary habits',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', enum: ['muscle_gain', 'fat_loss', 'endurance', 'health', 'recovery'], description: 'Fitness goal' },
          budget: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Budget level' },
        },
        required: ['goal'],
      },
    },
  ],

  aiSystemPromptAddition: `Tu as accès au catalogue de compléments alimentaires Ziko. Tu peux chercher des produits, comparer les prix et recommander des compléments en fonction des objectifs de l'utilisateur. Utilise les outils supplements_search, supplements_compare_prices et supplements_recommend pour fournir des conseils personnalisés.`,
};

export default supplementsManifest;
