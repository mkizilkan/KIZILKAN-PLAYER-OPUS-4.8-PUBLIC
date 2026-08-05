/**
 * KIZILKAN PLAYER — Odak Takipli Kaydırma
 * Dosya  : frontend/src/hooks/useFocusScroll.ts
 * Sürüm  : v2.0.0 (v9.6.0)
 *
 * react-native-tvos #296:
 * Android TV odak değişince listeyi KENDİ kaydırır. JS scrollToIndex ile
 * çift kaydırma → ağır çekim + odak dışarı kayma.
 *
 * v9.6.0: TV'de onItemFocus NO-OP (Android native'e güven).
 */
import { useCallback, useRef } from "react";
import { Platform, type FlatList } from "react-native";

function isTvRuntime(): boolean {
  try {
    // @ts-ignore
    if (Platform.isTV === true) return true;
  } catch { /* yoksay */ }
  return false;
}

export function useFocusScroll<T>(opts?: { forceScroll?: boolean }) {
  const listRef = useRef<FlatList<T> | null>(null);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceScroll = opts?.forceScroll === true;

  const onItemFocus = useCallback((index: number) => {
    // TV: kendi kaydırmamızı YAPMIYORUZ (#296)
    if (isTvRuntime() && !forceScroll) return;

    const list = listRef.current;
    if (!list || index < 0) return;
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      try {
        list.scrollToIndex({ index, animated: false, viewPosition: 0.5 });
      } catch { /* henüz ölçülmedi */ }
    }, 16);
  }, [forceScroll]);

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const list = listRef.current;
      if (!list) return;
      try {
        list.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: false,
        });
        requestAnimationFrame(() => {
          try {
            list.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.5 });
          } catch { /* yoksay */ }
        });
      } catch { /* yoksay */ }
    },
    []
  );

  return { listRef, onItemFocus, onScrollToIndexFailed };
}
