/**
 * SmartVideoPlayer — Dual-engine playback wrapper.
 *
 * Strategy:
 *  1) Start with ExoPlayer (via expo-video). Low CPU, native codec accel.
 *  2) On error → automatically switch to VLC (react-native-vlc-media-player).
 *     libVLC supports far more codecs & container formats (AVI, WMV, FLV,
 *     HEVC 10-bit, DTS, RTSP, custom UA/Referer headers, etc).
 *  3) On web / Expo Go where VLC native module isn't linked, stays on ExoPlayer
 *     and shows the original error (VLC is a no-op).
 *
 * The wrapper exposes the same look-and-feel as VideoView but has an internal
 * "engine" state and a small overlay badge showing which engine is active
 * (only visible in the Stats sheet in the player).
 */
import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { View, StyleSheet, Platform, Text } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { VLCPlayer } from "@/src/native/vlc";

export type Engine = "exo" | "vlc";

export interface SmartVideoRef {
  play: () => void;
  pause: () => void;
  seekBy: (sec: number) => void;
  setRate: (rate: number) => void;
  currentTime(): number;
  duration(): number;
  currentEngine(): Engine;
  switchToVLC: () => void;
  replay: () => void;
}

interface Props {
  source: string;
  autoplay?: boolean;
  contentFit?: "contain" | "cover" | "fill";
  onError?: (msg: string) => void;
  onLoad?: (info: { duration?: number; width?: number; height?: number }) => void;
  onPlayingChange?: (playing: boolean) => void;
  onProgress?: (currentTime: number, duration: number) => void;
  headers?: Record<string, string>;
  style?: any;
}

export const SmartVideoPlayer = forwardRef<SmartVideoRef, Props>(function SmartVideoPlayer(props, ref) {
  const { source, autoplay = true, contentFit = "contain", onError, onLoad, onPlayingChange, onProgress, headers, style } = props;
  const [engine, setEngine] = useState<Engine>("exo");
  const [exoError, setExoError] = useState<string | null>(null);
  const exoPlayer = useVideoPlayer(source, (p) => {
    p.loop = false;
    if (autoplay) p.play();
  });
  const vlcRef = useRef<any>(null);
  const [vlcCurrentTime, setVlcCurrentTime] = useState(0);
  const [vlcDuration, setVlcDuration] = useState(0);
  const [vlcRate, setVlcRate] = useState(1.0);

  // Reset engine when source changes
  useEffect(() => {
    setEngine("exo");
    setExoError(null);
    setVlcCurrentTime(0);
    setVlcDuration(0);
  }, [source]);

  // ExoPlayer error listener → fallback to VLC (if available)
  useEffect(() => {
    if (!exoPlayer) return;
    const sub = exoPlayer.addListener("statusChange", (event: any) => {
      if (event?.error) {
        const msg = String(event.error?.message || event.error);
        setExoError(msg);
        // Native builds resolve VLCPlayer to the linked VlcPlayerView wrapper.
        // Web resolves the platform stub; do not test a component function for
        // truthiness because TypeScript correctly treats it as always defined.
        if (engine === "exo") {
          console.log("[SmartVideoPlayer] ExoPlayer failed → switching to VLC:", msg);
          setEngine("vlc");
          // Also stop the exo player to free resources
          try { exoPlayer.pause(); } catch {}
        } else if (onError) {
          onError(msg);
        }
      } else if (event?.status === "readyToPlay") {
        try {
          onLoad?.({
            duration: (exoPlayer as any).duration || 0,
            width: (exoPlayer as any).videoSize?.width,
            height: (exoPlayer as any).videoSize?.height,
          });
        } catch {}
      }
    });
    const psub = exoPlayer.addListener("playingChange", (e: any) => {
      onPlayingChange?.(!!e?.isPlaying);
    });
    return () => { sub.remove(); psub.remove(); };
  }, [exoPlayer, engine, onError, onLoad, onPlayingChange]);

  // Poll ExoPlayer time
  useEffect(() => {
    if (engine !== "exo" || !exoPlayer) return;
    const t = setInterval(() => {
      try {
        const cur = (exoPlayer as any).currentTime || 0;
        const dur = (exoPlayer as any).duration || 0;
        if (dur > 0) onProgress?.(cur, dur);
      } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, [engine, exoPlayer, onProgress]);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (engine === "exo") { try { exoPlayer?.play(); } catch {} }
      else { try { vlcRef.current?.resume?.(); } catch {} }
    },
    pause: () => {
      if (engine === "exo") { try { exoPlayer?.pause(); } catch {} }
      else { try { vlcRef.current?.pause?.(); } catch {} }
    },
    seekBy: (sec: number) => {
      if (engine === "exo") {
        try { const cur = (exoPlayer as any).currentTime || 0; (exoPlayer as any).currentTime = Math.max(0, cur + sec); } catch {}
      } else {
        try {
          const target = Math.max(0, vlcCurrentTime + sec);
          vlcRef.current?.seek?.(vlcDuration > 0 ? target / vlcDuration : 0);
        } catch {}
      }
    },
    setRate: (rate: number) => {
      if (engine === "exo") {
        try { (exoPlayer as any).playbackRate = rate; } catch {}
      } else {
        setVlcRate(rate);
      }
    },
    currentTime: () => engine === "exo" ? ((exoPlayer as any)?.currentTime || 0) : vlcCurrentTime,
    duration: () => engine === "exo" ? ((exoPlayer as any)?.duration || 0) : vlcDuration,
    currentEngine: () => engine,
    switchToVLC: () => { setEngine("vlc"); },
    replay: () => {
      if (engine === "exo") {
        try { (exoPlayer as any).currentTime = 0; exoPlayer?.play(); } catch {}
      } else {
        try { vlcRef.current?.seek?.(0); vlcRef.current?.resume?.(); } catch {}
      }
    },
  }), [engine, exoPlayer, vlcCurrentTime, vlcDuration]);

  return (
    <View style={[styles.container, style]}>
      {engine === "exo" && (
        <VideoView
          player={exoPlayer}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={Platform.OS === "ios"}
        />
      )}

      {engine === "vlc" && (
        <VLCPlayer
          ref={vlcRef}
          uri={source}
          style={StyleSheet.absoluteFill}
          paused={!autoplay}
          contentFit={contentFit}
          rate={vlcRate}
          onTimeChanged={(ms: number) => {
            const cur = Math.max(0, ms) / 1000;
            setVlcCurrentTime(cur);
            if (vlcDuration > 0) onProgress?.(cur, vlcDuration);
          }}
          onFirstPlay={(info) => {
            const dur = Math.max(0, info.length || 0) / 1000;
            setVlcDuration(dur);
            onLoad?.({ duration: dur, width: info.width, height: info.height });
            onPlayingChange?.(true);
          }}
          onError={(message: string) => onError?.(String(message || "VLC oynatma hatası"))}
          onPlaying={() => onPlayingChange?.(true)}
          onPaused={() => onPlayingChange?.(false)}
        />
      )}

      {/* Engine badge — visible briefly on switch */}
      {engine === "vlc" && exoError && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>VLC MOTORU</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  badge: {
    position: "absolute", top: 20, right: 20,
    backgroundColor: "rgba(229,10,20,0.9)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
});
