// Libelles francais du Garde-manger (v1.20 Phase 10, PANT-07). Aucun mot anglais visible :
// un test parcourt toutes ces valeurs. Les ecrans du module lisent ces constantes directement
// (les ecrans de plugin codent leurs chaines en francais, cf. CLAUDE.md > i18n).

export const COPY = {
  title: 'Garde-manger',
  tabs: { inventory: 'Inventaire', recipes: 'Recettes', shopping: 'Courses' },

  // Inventaire
  searchLabel: 'Rechercher dans le garde-manger',
  searchPlaceholder: 'Rechercher un article',
  addItem: 'Ajouter un article',
  emptyTitle: 'Ton garde-manger est vide',
  emptyBody: 'Ajoute ce que tu as pour obtenir des recettes adaptées et une liste de courses automatique.',
  emptyScan: 'Scanner un code-barres',
  emptyManual: 'Ajouter à la main',
  emptyLocation: 'Rien dans cet emplacement',
  emptyLocationBody: 'Ajoute un article ou choisis un autre emplacement.',
  noResult: 'Aucun résultat',
  loadError: 'Impossible de charger le garde-manger',
  retry: 'Réessayer',

  // Fiche article
  itemQuantity: 'Quantité',
  itemExpiry: 'À consommer avant',
  itemNoExpiry: 'Pas de date',
  itemToShopping: 'Aux courses',
  itemUse: 'Utiliser',
  itemRemove: 'Retirer du garde-manger',
  itemEdit: 'Modifier',
  itemClose: 'Fermer',
  decrease: 'Diminuer la quantité',
  increase: 'Augmenter la quantité',
  addedToShopping: 'Ajouté aux courses',
  actionError: 'Action impossible. Réessaie.',
  removeTitle: 'Retirer cet article ?',
  removeBody: 'Il disparaîtra de ton garde-manger.',
  cancel: 'Annuler',
  removeConfirm: 'Retirer',

  // Formulaire
  formAddTitle: 'Ajouter un article',
  formEditTitle: "Modifier l'article",
  formBack: 'Retour',
  scanButton: 'Scanner un code-barres',
  prefillBanner: (code: string) => `Prérempli depuis le code-barres ${code}. Vérifie et complète.`,
  prefillKcal: (kcal: number) => `${kcal} kcal pour 100 g, repris de la fiche produit.`,
  fieldName: 'Nom',
  fieldNamePlaceholder: 'Nom du produit (ex : Blanc de poulet)',
  fieldQuantity: 'Quantité',
  fieldUnit: 'Unité',
  fieldCategory: 'Catégorie',
  fieldLocation: 'Rangé dans',
  fieldExpiry: 'À consommer avant',
  fieldExpiryNone: 'À choisir',
  fieldExpiryClear: 'Effacer la date',
  fieldThreshold: 'Seuil de stock bas',
  fieldThresholdPlaceholder: 'Par défaut : 1',
  saveAdd: 'Ajouter au garde-manger',
  saveEdit: 'Enregistrer les modifications',
  delete: 'Supprimer',
  deleteTitle: "Supprimer l'article ?",
  deleteBody: 'Cette action est irréversible.',
  errorTitle: 'Erreur',
  errorSave: "Impossible d'enregistrer. Vérifie ta connexion.",
  validationName: 'Le nom du produit est requis.',
  validationQuantity: 'La quantité doit être supérieure à 0.',

  // Scan
  scanTitle: 'Scanner un code-barres',
  scanHint: 'Place le code dans le cadre. La détection est automatique.',
  scanSearching: 'Recherche du produit...',
  scanManual: 'Saisir à la main',
  scanClose: 'Fermer le scanner',
  scanUnknownTitle: 'Produit introuvable',
  scanUnknownBody: "Ce code n'est pas dans la base. Saisis l'article à la main.",
  cameraOffTitle: "L'accès à la caméra est désactivé",
  cameraOffBody: "Pour scanner, autorise la caméra dans les réglages. Tu peux aussi saisir l'article à la main.",
  openSettings: 'Ouvrir les réglages',

  // Recettes
  macrosLeft: "Il te reste aujourd'hui",
  macrosUnit: 'g prot.',
  macrosBasis: (n: number) => `Basé sur ${n} article${n > 1 ? 's' : ''} de ton garde-manger.`,
  generate: (credits: number) => `Générer des recettes · ${credits} crédit${credits > 1 ? 's' : ''}`,
  regenerate: (credits: number) => `Régénérer · ${credits} crédit${credits > 1 ? 's' : ''}`,
  generating: 'Génération en cours...',
  proposals: 'Propositions',
  preferencesPlaceholder: 'Ex : végétarien, rapide, sans gluten...',
  recipesEmptyTitle: 'Découvre des recettes',
  recipesEmptyBody: 'Elles tiennent compte de ton garde-manger et des macros qu’il te reste aujourd’hui.',
  recipesEmptyPantry: 'Ajoute des articles à ton garde-manger pour générer des recettes.',
  recipesError: 'Impossible de générer des recettes',
  fitsMacros: 'rentre dans tes macros',
  ingredientsOf: (a: number, t: number) => `${a} sur ${t} ingrédients`,
  missingPrefix: 'Manque : ',
  creditsOutTitle: 'Crédits épuisés',
  creditsOutBody: 'Tu as utilisé tes crédits IA du jour. Gagne-en en t’entraînant ou en loguant tes repas.',
  notSignedIn: 'Tu dois être connecté pour générer des recettes.',

  // Courses
  shopAddPlaceholder: 'Ajouter un article à la liste',
  shopAddLabel: 'Ajouter un article à la liste',
  shopMissingGroup: 'Il manque dans ton frigo',
  shopManualGroup: 'Ajoutés par moi',
  shopEmptyTitle: 'Rien à acheter',
  shopEmptyBody: 'Ton frigo est bien rempli. Les articles bas ou expirés apparaîtront ici.',
  shopPut: (n: number) => `Ranger ${n} article${n > 1 ? 's' : ''} dans le garde-manger`,
  shopPutting: 'Rangement en cours...',
  shopPutDone: (n: number) => `${n} article${n > 1 ? 's rangés' : ' rangé'} dans le garde-manger`,
  shopForRecipe: (name: string) => `Pour : ${name}`,
  shopRestock: (q: string) => `À racheter : ${q}`,
  shopRemoveLine: 'Retirer de la liste',
  shopAddError: "Impossible d'ajouter à la liste. Réessaie.",
  shopPutError: 'Impossible de ranger. Réessaie.',
  shopShare: 'Partager la liste',
  shopShareTitle: 'Liste de courses Ziko',
  checked: 'Coché',
  unchecked: 'Non coché',

  // Expiration (texte seulement, jamais la couleur seule)
  expired: 'EXPIRÉ',
} as const;

/** Toutes les chaines statiques + un echantillon des chaines parametrees, pour le test PANT-07. */
export function allCopyStrings(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') {
      try {
        const a = (v as (...args: any[]) => unknown)(2, 3);
        if (typeof a === 'string') out.push(a);
        const b = (v as (...args: any[]) => unknown)('x');
        if (typeof b === 'string') out.push(b);
      } catch {
        /* ignore */
      }
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(COPY);
  return out;
}
