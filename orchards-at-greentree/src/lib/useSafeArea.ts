import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * One place that knows about safe-area insets, so notch/gesture-bar handling
 * can change without touching every screen.
 */
export function useSafeArea() {
  const insets = useSafeAreaInsets();
  return {
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  };
}
