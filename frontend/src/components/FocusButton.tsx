/**
 * KIZILKAN PLAYER — Evrensel Odaklanabilir Düğme
 * Dosya  : frontend/src/components/FocusButton.tsx
 * Sürüm  : v1.1.0 (v9.6.0)
 *
 * v9.6.0: forwardRef — requestTVFocus / findNodeHandle / nextFocus* için zorunlu.
 */
import React, { forwardRef } from "react";
import { TouchableOpacity, type TouchableOpacityProps } from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { useTVFocus, focusStyle } from "@/src/hooks/useTVFocus";

export interface FocusButtonProps extends TouchableOpacityProps {
  focusRadius?: number;
  autoFocus?: boolean;
}

export const FocusButton = forwardRef<any, FocusButtonProps>(function FocusButton(
  {
    style,
    children,
    focusRadius = 12,
    autoFocus,
    onFocus,
    onBlur,
    ...rest
  },
  ref
) {
  const { colors } = useTheme();
  const { isFocused, onFocus: markFocused, onBlur: markBlurred } = useTVFocus();

  return (
    <TouchableOpacity
      ref={ref}
      {...rest}
      focusable
      hasTVPreferredFocus={autoFocus}
      onFocus={(e) => { markFocused(); onFocus?.(e); }}
      onBlur={(e) => { markBlurred(); onBlur?.(e); }}
      style={[style, focusStyle(colors.brandPrimary, isFocused, focusRadius)]}
    >
      {children}
    </TouchableOpacity>
  );
});

export default FocusButton;
