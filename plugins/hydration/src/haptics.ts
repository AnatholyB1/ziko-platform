/** Retour haptique leger (HY-3). Charge expo-haptics paresseusement ; injectable pour les tests. */
import { Platform } from 'react-native';

interface HapticsModule {
  impactAsync(style: unknown): Promise<void>;
  ImpactFeedbackStyle: { Light: unknown };
}

let override: HapticsModule | null = null;
export function __setHapticsForTest(m: HapticsModule | null): void {
  override = m;
}

export async function lightImpact(): Promise<void> {
  if (!override && Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const h: HapticsModule = override ?? require('expo-haptics');
    await h.impactAsync(h.ImpactFeedbackStyle.Light);
  } catch {
    /* pas de haptique disponible : sans effet */
  }
}
