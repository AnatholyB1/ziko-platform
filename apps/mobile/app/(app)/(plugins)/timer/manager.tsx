import { Redirect } from 'expo-router';

// P20 : la gestion des presets vit dans chaque onglet du Timer ; cette route (ancien deep link IA) redirige.
export default function TimerManagerRoute() {
  return <Redirect href="/(plugins)/timer/dashboard" />;
}
