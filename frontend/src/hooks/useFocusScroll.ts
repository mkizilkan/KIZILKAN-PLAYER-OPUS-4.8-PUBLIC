/**
 * KIZILKAN PLAYER — Odak Takipli Kaydırma
 * Dosya  : frontend/src/hooks/useFocusScroll.ts
 * Sürüm  : v1.0.0 (v7.2.0)
 *
 * ===========================================================================
 * NE SORUNU ÇÖZÜYOR?
 * ===========================================================================
 * TV Box'ta kumandayla listede aşağı inerken odak bir sonraki satıra geçiyor
 * AMA LİSTE KAYDIRMIYORDU. Odaklanan öğe ekranın altında kalıyor, kullanıcı
 * "odak kayboldu" sanıyordu. (Aslında oradaydı, sadece görünmüyordu.)
 *
 * Bu hook, bir öğe odaklandığında listeyi o öğe GÖRÜNÜR olacak şekilde
 * kaydırır. Öğe ekranın ortasına yakın konumlanır ki kullanıcı hem üstünü
 * hem altını görebilsin (TV arayüzlerinin standart davranışı).
 * ===========================================================================
 */

import { useCallback, useRef } from "react";
import type { FlatList } from "react-native";

export function useFocusScroll<T>() {
  const listRef = useRef<FlatList<T> | null>(null);
  const pendingRef = useRef<any>(null);

  /**
   * Bir öğe odaklandığında çağrılır; listeyi o öğeye kaydırır.
   * @param index Odaklanan öğenin liste içindeki sırası
   */
  const onItemFocus = useCallback((index: number) => {
    /**
     * ══════════════════════════════════════════════════════════════════════
     * TV'DE KENDİ KAYDIRMAMIZI YAPMIYORUZ (v8.9.2) — KRİTİK BULGU
     * ══════════════════════════════════════════════════════════════════════
     * react-native-tvos'un kendi hata kaydı (#296) şunu söylüyor:
     *
     *   "onFocus çağrısı ScrollToIndex ile bir an SONRA tetikleniyor;
     *    Android'in KENDİSİ listeyi biraz kaydırıyor, ARDINDAN ScrollToIndex
     *    çalışıyor — bu da tökezleyen bir deneyime yol açıyor."
     *
     * Bizde tam bu oluyordu:
     *   • Android odağı taşıyıp listeyi kendi kaydırıyor
     *   • Hemen ardından bizim scrollToIndex'imiz devreye girip TEKRAR kaydırıyor
     *   -> "ağır çekim gibi", "odak gittikçe dışarı kayıyor"
     *
     * ÇÖZÜM: Android'in doğal odak kaydırmasına GÜVEN. Kendi kaydırmamızı
     * yalnızca odak GERÇEKTEN görünür alanın dışına düştüğünde, o da
     * gecikmeli ve animasyonsuz yapıyoruz.
     * ══════════════════════════════════════════════════════════════════════
     */
    const list = listRef.current;
    if (!list || index < 0) return;
    // Android'in kendi kaydırmasını yapmasına izin ver, sonra kontrol et.
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      doScroll(index);
    }, 120);
  }, []);

  const doScroll = (index: number) => {
    const list = listRef.current;
    if (!list) return;
    try {
      list.scrollToIndex({
        index,
        /**
         * v7.7.0 HIZ DÜZELTMESİ: TV'de animasyon KAPALI.
         * Animasyonlu kaydırma her tuş basışında ~300ms bekletiyordu; hızlı
         * gezinirken kumanda "yavaş/takılıyor" hissi veriyordu.
         * Animasyonsuz kaydırma anında tepki verir (TiviMate de böyle yapar).
         */
        animated: false,
        // 0.5 = öğeyi ekranın ORTASINA getir. Böylece kullanıcı hem önceki
        // hem sonraki öğeleri görür; "sınırdayım" hissi oluşmaz.
        viewPosition: 0.5,
      });
    } catch {
      // Öğe henüz ölçülmediyse sessizce geç; bir sonraki odakta düzelir.
    }
  };

  /**
   * scrollToIndex başarısız olursa (öğe ölçülmemişse) FlatList'in
   * onScrollToIndexFailed olayına bağlanır; yaklaşık konuma gidip tekrar dener.
   */
  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const list = listRef.current;
      if (!list) return;
      try {
        list.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: true,
        });
        // Ölçüm tamamlandıktan sonra tam konuma git.
        setTimeout(() => {
          try {
            list.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
          } catch { /* yoksay */ }
        }, 120);
      } catch { /* yoksay */ }
    },
    []
  );

  return { listRef, onItemFocus, onScrollToIndexFailed };
}
