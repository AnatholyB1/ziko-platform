import { Stack } from 'expo-router';

// Le tableau (`index`) est toujours la racine de la pile : un ecran ouvert directement depuis l'accueil (assistant,
// atelier, IA simple) a le tableau sous lui, donc retour / tap sur l'onglet y reviennent (UATN-03).
export const unstable_settings = { initialRouteName: 'index' };

export default function WorkoutLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
