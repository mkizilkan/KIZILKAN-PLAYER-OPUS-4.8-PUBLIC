/**
 * KIZILKAN PLAYER — TV Modu Bağlamı
 * Dosya  : frontend/src/store/TvContext.tsx
 * Sürüm  : v1.0.0 (v5.2.0)
 *
 * TV modunu tüm ekranlara dağıtır. Ekranlar `useTv()` ile:
 *   - isTv           : TV düzenine geç (büyük yazı, kalın odak, overscan)
 *   - focusRing(f)   : odaklı öğe için hazır stil
 *   - overscan       : kenar boşluğu
 * bilgilerini alır.
 *
 * Mod "auto" ise cihaz otomatik algılanır; kullanıcı ayarlardan zorlayabilir
 * (bazı ucuz kutular kendini TV olarak bildirmiyor).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  resolveTvMode,
  loadTvModePref,
  saveTvMode,
  focusStyle,
  TV_OVERSCAN,
  TV_TEXT_SCALE,
  type TvMode,
} from "@/src/utils/tv";

interface TvContextValue {
  /** TV düzeni aktif mi? */
  isTv: boolean;
  /** Kullanıcı tercihi (auto/on/off). */
  mode: TvMode;
  setMode: (m: TvMode) => Promise<void>;
  /** TV ana ekran düzeni: "classic" (mevcut) | "columns" (üç sütunlu) */
  tvLayout: TvLayout;
  setTvLayout: (l: TvLayout) => Promise<void>;
  /** Sütunlu düzende sağ panelde canlı önizleme oynatılsın mı? */
  tvPreview: boolean;
  setTvPreview: (v: boolean) => Promise<void>;
  /** Odaklı öğe için stil (TV değilse null döner). */
  focusRing: (focused: boolean, accent: string) => any;
  /** Kenar güvenli boşluk (TV'de > 0). */
  overscan: number;
  /** Yazı büyütme çarpanı (TV'de > 1). */
  textScale: number;
}

const TvContext = createContext<TvContextValue | null>(null);

export function TvProvider({ children }: { children: React.ReactNode }) {
  const [isTv, setIsTv] = useState(false);
  const [mode, setModeState] = useState<TvMode>("auto");
  /**
   * TV ARAYÜZ SEÇİMİ (v8.0.0)
   * "classic"  : mevcut tek sütunlu düzen (varsayılan — hiçbir şey değişmez)
   * "columns"  : kategoriler | kanallar | önizleme+bilgi (TiviMate tarzı)
   * Kullanıcı Ayarlar'dan seçer; telefon bu ayardan ETKİLENMEZ.
   */
  const [tvLayout, setTvLayoutState] = useState<TvLayout>("classic");
  const [tvPreview, setTvPreviewState] = useState(true);   // varsayılan AÇIK

  useEffect(() => {
    let alive = true;
    (async () => {
      const [resolved, pref] = await Promise.all([resolveTvMode(), loadTvModePref()]);
      if (!alive) return;
      setIsTv(resolved);
      setModeState(pref);
      const lay = await storage.getItem<string>(TV_LAYOUT_KEY, "classic");
      if (lay === "columns" || lay === "classic") setTvLayoutState(lay);
      const prev = await storage.getItem<string>(TV_PREVIEW_KEY, "1");
      setTvPreviewState(prev !== "0");
    })();
    return () => { alive = false; };
  }, []);

  const setMode = useCallback(async (m: TvMode) => {
    await saveTvMode(m);
    setModeState(m);
    setIsTv(await resolveTvMode());
  }, []);

  const setTvLayout = useCallback(async (l: TvLayout) => {
    setTvLayoutState(l);
    await storage.setItem(TV_LAYOUT_KEY, l);
  }, []);

  const setTvPreview = useCallback(async (v: boolean) => {
    setTvPreviewState(v);
    await storage.setItem(TV_PREVIEW_KEY, v ? "1" : "0");
  }, []);

  const focusRing = useCallback(
    (focused: boolean, accent: string) => (isTv ? focusStyle(focused, accent) : null),
    [isTv]
  );

  const value = useMemo<TvContextValue>(
    () => ({
      isTv,
      mode,
      setMode,
      focusRing,
      overscan: isTv ? TV_OVERSCAN : 0,
      tvLayout, setTvLayout, tvPreview, setTvPreview,
      textScale: isTv ? TV_TEXT_SCALE : 1,
    }),
    [isTv, mode, setMode, focusRing]
  );

  return <TvContext.Provider value={value}>{children}</TvContext.Provider>;
}

export function useTv(): TvContextValue {
  const ctx = useContext(TvContext);
  // Sağlayıcı yoksa güvenli varsayılan (telefon davranışı).
  if (!ctx) {
    return {
      isTv: false,
      mode: "auto",
      setMode: async () => {},
      focusRing: () => null,
      overscan: 0,
      textScale: 1,
    };
  }
  return ctx;
}
