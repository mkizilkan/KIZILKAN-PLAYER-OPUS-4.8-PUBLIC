/**
 * KIZILKAN PLAYER — Kalıcı Player Durumu (YOL B / FAZ 1)
 *
 * Amaç: player'ı navigasyon yığınından çıkarıp KÖK seviyede her zaman mount
 * edilen bir katman yapmak. Böylece kanal açmak "yeni ekran mount" değil,
 * sadece bu context'teki kaynağı değiştirmek olur (zap gibi). Video yüzeyi
 * hiç yeniden-attach olmadığı için arkadaki temalı ekran sızamaz → şerit/tint
 * kökten biter.
 *
 * source === null  → player gizli/boşta (yüzey bağlı kalır ama görünmez).
 * source !== null  → player görünür, o kanalı oynatır.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type PlayerSource = { id: string; ext?: string; localUri?: string; title?: string } | null;

type PlayerContextValue = {
  source: PlayerSource;
  visible: boolean;
  openPlayer: (s: { id?: string; ext?: string; localUri?: string; title?: string }) => void;
  closePlayer: () => void;
  switchChannel: (id: string) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = useState<PlayerSource>(null);

  const openPlayer = useCallback((s: { id?: string; ext?: string; localUri?: string; title?: string }) => {
    // v10.3.1: indirilen dosyalar için localUri/title de taşınır.
    setSource({ id: s.id ?? "", ext: s.ext, localUri: s.localUri, title: s.title });
  }, []);

  const closePlayer = useCallback(() => {
    setSource(null);
  }, []);

  // Zap: katmanı yeniden mount ETME, sadece kanal id'sini değiştir.
  const switchChannel = useCallback((id: string) => {
    // Zap: yalnız canlı kanal id'si değişir; VOD/indirilen alanları TEMİZLENİR.
    setSource({ id });
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({ source, visible: source !== null, openPlayer, closePlayer, switchChannel }),
    [source, openPlayer, closePlayer, switchChannel]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer, PlayerProvider içinde kullanılmalı");
  return ctx;
}
