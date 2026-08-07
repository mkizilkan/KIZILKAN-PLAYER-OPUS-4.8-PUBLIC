/**
 * KIZILKAN PLAYER — Evrensel Odaklanabilir Düğme
 * Dosya  : frontend/src/components/FocusButton.tsx
 * Sürüm  : v1.1.0 (v9.12.0)
 *
 * ===========================================================================
 * NEDEN VAR?
 * ===========================================================================
 * TV Box'ta kumandayla gezerken kullanıcının NEREDE olduğu belli olmuyordu.
 * Sebep: odak göstergesi yalnızca liste bileşenlerine (kanal satırı, afiş
 * ızgarası) eklenmişti; liste ekleme, ayarlar, arama, detay gibi EKRANLARIN
 * kendi düğmeleri kapsam dışındaydı.
 *
 * Bu bileşen TouchableOpacity ile AYNI API'ye sahiptir; tek farkı odaklanınca
 * belirgin bir çerçeve + parlama + büyüme uygulamasıdır. Böylece bir ekranı
 * TV uyumlu yapmak için sadece TouchableOpacity -> FocusButton değişimi yeter.
 *
 * Telefonda görünüm DEĞİŞMEZ (odak olayları sadece TV'de tetiklenir).
 * ===========================================================================
 */

import React, { forwardRef } from "react";
import { TouchableOpacity, type TouchableOpacityProps } from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { useTVFocus, focusStyle } from "@/src/hooks/useTVFocus";

export interface FocusButtonProps extends TouchableOpacityProps {
  /** Odak çerçevesinin köşe yuvarlaklığı (öğenin kendi radius'una uysun). */
  focusRadius?: number;
  /** Bu düğme ekran açılınca otomatik odakta olsun mu? */
  autoFocus?: boolean;
}

export const FocusButton = forwardRef<any, FocusButtonProps>(function FocusButton({
  style,
  children,
  focusRadius = 12,
  autoFocus,
  onFocus,
  onBlur,
  ...rest
}: FocusButtonProps, ref) {
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
