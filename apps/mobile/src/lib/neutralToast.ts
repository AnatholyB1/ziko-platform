import { Platform, ToastAndroid } from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';

/** Message bref et neutre : toast natif sur Android, alerte du design system ailleurs. */
export function neutralToast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG);
    return;
  }
  showAlert('Information', message);
}
