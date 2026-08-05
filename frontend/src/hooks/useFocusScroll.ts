/**
 * KIZILKAN PLAYER — Odak Takipli Kaydırma
 * Dosya  : frontend/src/hooks/useFocusScroll.ts
 * Sürüm  : v2.0.0 (v9.5.0)
 *
 * v9.5.0 DÜZELTMESİ:
 * Android TV doğal odak kaydırmasına öncelik verir. Uygulama yalnızca odaklanan
 * öğe gerçekten görünür aralığın dışındaysa animasyonsuz scrollToIndex çağırır.
 * Bekleyen zamanlayıcılar unmount sırasında temizlenir.
 */
import { useCallback, useEffect, useRef } from "react";
import type { FlatList, ViewToken } from "react-native";

export function useFocusScroll<T>() {
  const listRef = useRef<FlatList<T> | null>(null);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRangeRef = useRef<{ first: number; last: number } | null>(null);

  useEffect(() => () => {
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = null;
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<T>[] }) => {
    const indices = viewableItems
      .map(v => v.index)
      .filter((v): v is number => typeof v === "number")
      .sort((a, b) => a - b);
    visibleRangeRef.current = indices.length
      ? { first: indices[0], last: indices[indices.length - 1] }
      : null;
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 45,
    minimumViewTime: 40,
  }).current;

  const doScroll = useCallback((index: number) => {
    const list = listRef.current;
    if (!list) return;
    try {
      list.scrollToIndex({ index, animated: false, viewPosition: 0.5 });
    } catch {
      // Ölçülmemiş öğe onScrollToIndexFailed üzerinden ele alınır.
    }
  }, []);

  const onItemFocus = useCallback((index: number) => {
    const list = listRef.current;
    if (!list || index < 0) return;
    const range = visibleRangeRef.current;
    if (range && index >= range.first && index <= range.last) return;
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      const latest = visibleRangeRef.current;
      if (!latest || index < latest.first || index > latest.last) doScroll(index);
      pendingRef.current = null;
    }, 120);
  }, [doScroll]);

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const list = listRef.current;
      if (!list) return;
      try {
        list.scrollToOffset({
          offset: Math.max(0, info.averageItemLength * info.index),
          animated: false,
        });
        if (pendingRef.current) clearTimeout(pendingRef.current);
        pendingRef.current = setTimeout(() => {
          doScroll(info.index);
          pendingRef.current = null;
        }, 120);
      } catch {
        // Liste kapanmışsa işlem yapılmaz.
      }
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
