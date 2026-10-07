import { getWebApp } from './webapp';

type Impact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type Notify = 'error' | 'success' | 'warning';

export function hapticImpact(style: Impact = 'light') {
  try {
    const h = getWebApp()?.HapticFeedback as
      | { impactOccurred?: (s: string) => void }
      | undefined;
    h?.impactOccurred?.(style);
  } catch {
    /* ignore */
  }
}

export function hapticNotify(type: Notify = 'success') {
  try {
    const h = getWebApp()?.HapticFeedback as
      | { notificationOccurred?: (t: string) => void }
      | undefined;
    h?.notificationOccurred?.(type);
  } catch {
    /* ignore */
  }
}

export function hapticSelect() {
  try {
    const h = getWebApp()?.HapticFeedback as { selectionChanged?: () => void } | undefined;
    h?.selectionChanged?.();
  } catch {
    /* ignore */
  }
}
