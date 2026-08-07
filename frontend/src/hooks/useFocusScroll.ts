/**
 * KIZILKAN PLAYER — Odak Takipli Kaydırma
 * Dosya  : frontend/src/hooks/useFocusScroll.ts
 * Sürüm  : v1.1.0 (v9.12.0)
 *
 * v9.12.0: react-native-tvos #296 sınıfındaki "native scroll + ikinci
 * scrollToIndex" çakışmasını kökten azaltır. Programatik kaydırma yalnızca
 * odaklanan satır FlatList'in görünür indeksleri arasında DEĞİLSE yapılır.
 */
import { useCallback, useRef } from "react";
import type { FlatList, ViewToken } from "react-native";

export function useFocusScroll<T>() {
  const listRef = useRef<FlatList<T> | null>(null);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef<Set<number>>(new Set());

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 55,
    minimumViewTime: 40,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const next = new Set<number>();
    for (const token of viewableItems) {
      if (typeof token.index === "number") next.add(token.index);
    }
    visibleRef.current = next;
  }).current;

  const doScroll = useCallback((index: number) => {
    const list = listRef.current;
    if (!list || index < 0) return;
    try {
      list.scrollToIndex({ index, animated: false, viewPosition: 0.5 });
    } catch {
      // Ölçülmemiş satır onScrollToIndexFailed ile ele alınır.
    }
  }, []);

  const onItemFocus = useCallback((index: number) => {
    const list = listRef.current;
    if (!list || index < 0) return;

    // Öğenin en az %55'i görünüyorsa Android'in doğal TV kaydırmasına dokunma.
    if (visibleRef.current.has(index)) return;

    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null;
      if (!visibleRef.current.has(index)) doScroll(index);
    }, 90);
  }, [doScroll]);

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const list = listRef.current;
      if (!list) return;
      try {
        list.scrollToOffset({
          offset: Math.max(0, info.averageItemLength * Math.max(0, info.index - 2)),
          animated: false,
        });
        setTimeout(() => {
          if (!visibleRef.current.has(info.index)) doScroll(info.index);
        }, 80);
      } catch { /* bir sonraki odak olayı yeniden dener */ }
    },
    [doScroll]
  );

  return {
    listRef,
    onItemFocus,
    onScrollToIndexFailed,
    onViewableItemsChanged,
    viewabilityConfig,
  };
}
