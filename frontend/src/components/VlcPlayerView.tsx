/**
 * KIZILKAN PLAYER — VLC Motoru (expo-libvlc-player sarmalayıcı)
 * Dosya   : frontend/src/components/VlcPlayerView.tsx
 * Sürüm   : v1.0.0
 * Faz     : Player Motoru ADIM 2a
 *
 * ===========================================================================
 * NE İŞE YARIYOR?
 * ===========================================================================
 * expo-libvlc-player'ın LibVlcPlayerView'ını, player.tsx'in kolayca
 * kullanabileceği temiz bir arayüzle sarar. Asıl güç burada:
 *
 * 1) GÜÇLÜ libVLC OPTIONS (codec + ağ): "diğer player'ların açamadığını açma"
 *    - --network-caching: ağ tamponu (donmayı azaltır)
 *    - --http-reconnect / --http-continuous: kopan yayını yeniden kurar
 *    - Geniş codec desteği (VLC her formatı açar: HEVC, AV1, VP9, exotic audio)
 *
 * 2) GERÇEK HATA MESAJI (onEncounteredError): eski motordaki "[object Object]"
 *    yerine anlamlı mesaj.
 *
 * 3) BUFFER GÖSTERGESİ (onBuffering): gerçek yüklenme yüzdesi.
 *
 * Track seçimi UI + DVR kaydı (record) ADIM 2b'de eklenecek — bu bileşen
 * onESAdded ile parça listesini şimdiden dışarı veriyor (hazır olsun diye).
 * ===========================================================================
 */

import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
// Yeni motor. Adım 1'de paketin derlendiği doğrulandı.
import { LibVlcPlayerView, type LibVlcPlayerViewRef, type MediaTracks } from "expo-libvlc-player";

export interface VlcTrack {
  id: number;
  name: string;
}
export interface VlcTracks {
  audio: VlcTrack[];
  video: VlcTrack[];
  subtitle: VlcTrack[];
}

export interface VlcPlayerHandle {
  play: () => void;
  pause: () => void;
  stop: () => void;
  /** Zaman (ms) veya konum (0..1) ile sar. */
  seek: (value: number, type?: "time" | "position") => void;
  /** DVR kaydı başlat/durdur (ADIM 2b'de UI'ya bağlanacak). */
  record: (dir?: string) => void;
}

interface Props {
  uri: string;
  /** Ek libVLC options (üstüne eklenir). */
  extraOptions?: string[];
  paused?: boolean;
  rate?: number;
  volume?: number;
  contentFit?: "contain" | "cover" | "fill";
  /** Seçili parçalar (audio/subtitle track id). */
  tracks?: { audio?: number; subtitle?: number };
  onBuffering?: (progress: number) => void;
  onPlaying?: () => void;
  onPaused?: () => void;
  onError?: (message: string) => void;
  onTimeChanged?: (ms: number) => void;
  onTracks?: (tracks: VlcTracks) => void;
  /** İlk oynatmada medya bilgisi (boyut, süre). */
  onFirstPlay?: (info: { width: number; height: number; length: number }) => void;
}

/**
 * IPTV için optimize edilmiş varsayılan libVLC parametreleri.
 * "Diğer player'ların açamadığını açma" hedefinin kalbi bu ayarlar.
 */
export const DEFAULT_VLC_OPTIONS: string[] = [
  "--network-caching=1500",     // ağ tamponu (ms) — donma/kesilme azaltır
  "--live-caching=1500",        // canlı yayın tamponu
  "--file-caching=1500",        // yerel dosya tamponu
  "--http-reconnect",           // HTTP kopunca yeniden bağlan
  "--http-continuous",          // sürekli HTTP akışı
  "--adaptive-maxwidth=1920",   // adaptif akışta üst sınır (uyum)
  "--no-video-title-show",      // yayın başında dosya adı gösterme
  "--audio-time-stretch",       // ses hız uyumu (rate ile senkron)
];

export const VlcPlayerView = forwardRef<VlcPlayerHandle, Props>(function VlcPlayerView(
  {
    uri, extraOptions, paused, rate = 1, volume = 100, contentFit = "contain",
    tracks, onBuffering, onPlaying, onPaused, onError, onTimeChanged, onTracks, onFirstPlay,
  },
  ref
) {
  const innerRef = useRef<LibVlcPlayerViewRef>(null);

  useImperativeHandle(ref, () => ({
    play: () => { innerRef.current?.play().catch(() => {}); },
    pause: () => { innerRef.current?.pause().catch(() => {}); },
    stop: () => { innerRef.current?.stop().catch(() => {}); },
    seek: (value, type = "time") => { innerRef.current?.seek(value, type).catch(() => {}); },
    record: (dir) => { innerRef.current?.record(dir).catch(() => {}); },
  }), []);

  const options = extraOptions ? [...DEFAULT_VLC_OPTIONS, ...extraOptions] : DEFAULT_VLC_OPTIONS;

  return (
    <View style={styles.container}>
      <LibVlcPlayerView
        ref={innerRef}
        source={uri}
        options={options}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        rate={rate}
        volume={volume}
        autoplay={!paused}
        tracks={tracks}
        onBuffering={(e) => onBuffering?.(e.progress)}
        onPlaying={() => onPlaying?.()}
        onPaused={() => onPaused?.()}
        onEncounteredError={(e) => {
          // GERÇEK hata mesajı — "[object Object]" değil.
          const msg = e?.message || "Bilinmeyen oynatma hatası";
          onError?.(String(msg));
        }}
        onTimeChanged={(e) => onTimeChanged?.(e.value)}
        onESAdded={(e: MediaTracks) => {
          // Parça listesi hazır — ADIM 2b'de seçim UI'sına verilecek.
          onTracks?.({
            audio: e.audio || [],
            video: e.video || [],
            subtitle: e.subtitle || [],
          });
        }}
        onFirstPlay={(e) => onFirstPlay?.({ width: e.width, height: e.height, length: e.length })}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
});

export default VlcPlayerView;
