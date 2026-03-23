import { create } from 'zustand';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  show: (title: string, message?: string, buttons?: AlertButton[]) => void;
  hide: () => void;
}

export const useAlertStore = create<AlertState>()((set) => ({
  visible: false,
  title: '',
  message: undefined,
  buttons: [],

  show: (title, message, buttons) => set({
    visible: true,
    title,
    message,
    buttons: buttons ?? [{ text: 'OK', style: 'default' }],
  }),

  hide: () => set({ visible: false }),
}));

/**
 * Drop-in replacement for Alert.alert with the same signature.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
) {
  useAlertStore.getState().show(title, message, buttons);
}
