// HY-2 (DESIGN-CONTRACT lot E) : tuiles de log rapide de 132 dp, fond carte, bord, goutte, pastille PAR DEFAUT.
// Run 7 : un `style` FONCTION sur le Pressable (interop NativeWind v4) ne s'appliquait pas (tuiles de 103 dp, sans
// fond, collees a gauche). Le Pressable porte donc un style STATIQUE (dimensions) ; l'aspect (fond, bord, ombre,
// etat presse) vit dans un View interne, pilote par `pressed`. Module pur : testable sans React.

export const QUICK_TILE_HEIGHT = 132;

const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

/** Style du Pressable : statique, dimensions seulement. */
export const QUICK_TILE_OUTER_STYLE = { flex: 1, height: QUICK_TILE_HEIGHT } as const;

export function quickTileCardStyle(opts: { pressed: boolean; locked: boolean; surface: string; border: string; primary: string }) {
  const { pressed, locked, surface, border, primary } = opts;
  return {
    ...(pressed ? {} : CARD_SHADOW),
    flex: 1,
    height: QUICK_TILE_HEIGHT,
    backgroundColor: pressed ? '#F0EFE9' : surface,
    borderRadius: 16,
    borderWidth: pressed ? 2 : 1,
    borderColor: pressed ? primary : border,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    paddingHorizontal: 4,
    transform: [{ scale: pressed ? 0.98 : 1 }],
    opacity: locked && !pressed ? 0.7 : 1,
  };
}
