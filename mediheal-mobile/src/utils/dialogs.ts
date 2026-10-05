import { Alert, Platform } from 'react-native';

/**
 * Cross-platform dialogs.
 * react-native-web's Alert.alert is a no-op, so button callbacks never fire on web.
 * These helpers fall back to the browser's native confirm/alert dialogs there.
 */

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function confirmAction({
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
}: ConfirmOptions): void {
  if (Platform.OS === 'web') {
    const confirmed = typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`);
    if (confirmed) {
      void onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: () => void onConfirm(),
    },
  ]);
}

export function showMessage(title: string, message: string, onClose?: () => void): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
    onClose?.();
    return;
  }

  Alert.alert(title, message, [{ text: 'OK', onPress: onClose }]);
}
