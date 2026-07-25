import { useState, useCallback } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * useTVFocus — Returns focus state + handlers for TV D-pad / keyboard navigation.
 * Used on TouchableOpacity components to show a visible focus outline on Android TV / TV Box.
 */
export function useTVFocus() {
  const [isFocused, setIsFocused] = useState(false);
  const onFocus = useCallback(() => setIsFocused(true), []);
  const onBlur = useCallback(() => setIsFocused(false), []);
  return { isFocused, onFocus, onBlur };
}

/**
 * Style helper — Applies a red neon-ish focus outline when focused.
 */
export function focusStyle(color: string, isFocused: boolean, radius = 12): StyleProp<ViewStyle> {
  if (!isFocused) return null;
  return {
    borderColor: color,
    borderWidth: 3,
    shadowColor: color,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
    // Slight scale-up for TV feel
    transform: [{ scale: 1.04 }],
  };
}
