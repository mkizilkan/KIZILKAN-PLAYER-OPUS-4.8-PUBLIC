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

export function useFocusScroll<T>(columns: number = 1) {
  const listRef = useRef<FlatList<T> | null>(null);
  const pendingRef = useRef<any>(null);
  // v10.0.0: GRID-FARKINDALIK. Tek-sütun listede columns=1 (eski davranış).
  // Grid'de (numColumns=COL) karşılaştırma SATIR bazlı yapılır; aksi halde
  // bir satır aşağı = index+COL, VISIBLE_MARGIN(4)'ü aşıp her dikey harekette
  // programatik scroll tetikliyor (native + programatik = çift kaydırma,
  // posterler zıplıyor/yeniden yükleniyor). Ref ile güncel COL yakalanır.
  const colsRef = useRef(Math.max(1, columns));
  colsRef.current = Math.max(1, columns);
  /**
   * v9.12.0 — GÖRÜNÜRLÜK TAHMİNİ (GPT tespiti):
   * Eskiden yorum "yalnızca görünür alan dışına düşünce kaydır" diyordu ama kod
   * HER odakta scrollToIndex(viewPosition:0.5) yapıp listeyi TEKRAR ortalıyordu
   * (Android'in native kaydırmasıyla çift hareket = "ağır çekim").
   * Artık en son ORTALADIĞIMIZ indeksi hatırlıyoruz; odak bunun VISIBLE_MARGIN
   * kadar yakınındaysa (yani hâlâ görünür kabul edilir) HİÇ kaydırmıyoruz.
   * Yalnızca pencereden çıkınca kaydırıp yeni merkezi kaydediyoruz.
   */
  const lastCenteredRef = useRef<number>(-999); // v10.0.0: SATIR indeksi
  const VISIBLE_MARGIN = 4; // merkeze göre her iki yanda ~görünür SATIR sayısı

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
    // v9.12.0: Odak, son ortaladığımız indeksin görünür penceresi içindeyse
    // Android'in native kaydırması yeter; biz KAYDIRMAYIZ (çift hareketi keser).
    const row = Math.floor(index / colsRef.current);
    if (Math.abs(row - lastCenteredRef.current) <= VISIBLE_MARGIN) return;
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
        animated: false,
        viewPosition: 0.5,
      });
      lastCenteredRef.current = Math.floor(index / colsRef.current); // yeni merkez SATIRI
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
          animated: false,
        });
        // Ölçüm tamamlandıktan sonra tam konuma git (v9.12.0: animasyonsuz).
        setTimeout(() => {
          try {
            list.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.5 });
            lastCenteredRef.current = Math.floor(info.index / colsRef.current);
          } catch { /* yoksay */ }
        }, 120);
      } catch { /* yoksay */ }
    },
    []
  );

  return { listRef, onItemFocus, onScrollToIndexFailed };
}
