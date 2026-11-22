import { AccessibilityInfo, Platform, ToastAndroid } from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';

/**
 * Message bref et neutre : toast natif sur Android, alerte du design system ailleurs. `detail` = version complete d'un
 * message resume (le toast natif tronque au-dela de ~2 lignes) : annoncee aux lecteurs d'ecran sur Android, affichee
 * en entier dans l'alerte (qui passe a la ligne) ailleurs.
 */
export function neutralToast(message: string, detail?: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG);
    if (detail) AccessibilityInfo.announceForAccessibility(detail);
    return;
  }
  showAlert('Information', detail ?? message);
}
