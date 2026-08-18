/**
 * KIZILKAN PLAYER — Büyük Veri Deposu Arayüzü (ortak tip)
 * Dosya   : frontend/src/utils/storage/bigStore.types.ts
 * Sürüm   : v1.0.0
 * Faz     : FAZ A.4 / Bölüm 0
 *
 * Native (dosya sistemi) ve Web (AsyncStorage) uygulamaları bu SÖZLEŞMEYE uyar.
 * Metro, .native.ts / .web.ts uzantılarına göre doğru dosyayı otomatik seçer.
 */

/**
 * v12.0.0 — TÜR BAZLI AYRI DOSYALAR
 * Ağır veri tek dosyada tutulunca (kanallar + on binlerce film + diziler)
 * bir liste seçildiğinde HEPSİ birden okunup JSON.parse ediliyor ve JS iş
 * parçacığı saniyelerce kilitleniyordu (uygulama donuyor gibi görünüyordu).
 * Artık her tür AYRI dosyada: canlı izlemek için yalnız "channels" okunur,
 * filmler/diziler ancak o sekmeye girilince yüklenir.
 */
export type BigKind = 'channels' | 'vod' | 'series';

export interface BigStore {
  /** Ağır veriyi kalıcı olarak yazar. Başarı: true. Çağıran KONTROL etmeli. */
  write(id: string, data: unknown): Promise<boolean>;
  /** Ağır veriyi okur. Yok/hatalıysa fallback döner. */
  read<T>(id: string, fallback: T): Promise<T>;
  /** Veriyi siler. */
  remove(id: string): Promise<boolean>;
  /** Veri var mı? */
  exists(id: string): Promise<boolean>;
  /** v12.0.0: Tek türü yazar (channels/vod/series ayrı dosya). */
  writeKind(id: string, kind: BigKind, data: unknown): Promise<boolean>;
  /** v12.0.0: Tek türü okur. Yoksa eski tek-dosya biçiminden geçiş yapar. */
  readKind<T>(id: string, kind: BigKind, fallback: T): Promise<T>;
}
