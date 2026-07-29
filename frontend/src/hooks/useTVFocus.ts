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
    // v6.4.0: TV'de 2-3 metre uzaktan BAKILIYOR. Odak göstergesi zayıf kalıyordu;
    // kullanıcı kumandayla nerede olduğunu göremiyordu. Belirginlik artırıldı:
    // kalın çerçeve + iç dolgu + güçlü parlama + gözle görülür büyüme.
    borderColor: color,
    borderWidth: 4,
    borderRadius: radius,
    backgroundColor: color + "26",   // hafif marka rengi dolgu (%15 opaklık)
    shadowColor: color,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
    transform: [{ scale: 1.08 }],
    zIndex: 10,
  };
}

/**
 * AFİŞ/POSTER ODAK STİLİ (v6.4.0)
 * Film ve dizi afişleri için daha büyük ölçek — TV'de "hangi afişteyim"
 * sorusunu tereddütsüz yanıtlar. (Kullanıcının hatırladığı "afiş büyütmesi".)
 */
export function posterFocusStyle(color: string, isFocused: boolean, radius = 12): StyleProp<ViewStyle> {
  if (!isFocused) return null;
  return {
    borderColor: color,
    borderWidth: 4,
    borderRadius: radius,
    shadowColor: color,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
    transform: [{ scale: 1.16 }],   // afişler daha çok büyür
    zIndex: 20,
  };
}
