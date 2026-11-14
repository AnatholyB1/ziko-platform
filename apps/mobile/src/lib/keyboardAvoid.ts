/**
 * Comportement du KeyboardAvoidingView (UAT run 9, defaut 5 : le clavier recouvrait le champ de saisie de l'Atelier).
 * Avec l'edge-to-edge d'Expo SDK 54 / RN 0.81, Android ne redimensionne plus la fenetre (`adjustResize` n'agit plus) :
 * `behavior={undefined}` (ancien reglage Android) laissait le clavier par-dessus le champ. `padding` convient aux deux
 * plateformes. Pur : teste sans React Native.
 */
export type KeyboardAvoidBehavior = 'padding' | 'height' | 'position';

export function keyboardAvoidBehavior(_os?: string): KeyboardAvoidBehavior {
  return 'padding';
}
