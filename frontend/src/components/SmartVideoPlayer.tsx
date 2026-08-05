/**
 * KIZILKAN PLAYER — Çift Motorlu Akıllı Oynatıcı
 * Dosya: frontend/src/components/SmartVideoPlayer.tsx
 * Sürüm: v2.0.0 (v9.5.0)
 *
 * ExoPlayer ile başlar; ilk Exo hatasında bir kez VLC'ye geçer. VLC sarmalayıcı
 * API'si VlcPlayerView ile birebir uyumludur. Kaynak değişince fallback kilidi
 * sıfırlanır. Motorlar aynı anda oynatılmaz.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { VLCPlayer } from "@/src/native/vlc";
import type { VlcPlayerHandle } from "@/src/components/VlcPlayerView";

export type Engine = "exo" | "vlc";
export interface SmartVideoRef {
  play(): void; pause(): void; seekBy(sec: number): void; setRate(rate: number): void;
  currentTime(): number; duration(): number; currentEngine(): Engine;
  switchToVLC(): void; replay(): void;
}

function vlcHeaderOptions(headers?: Record<string, string>): { userAgent?: string; extraOptions?: string[] } {
  if (!headers) return {};
  const entries = Object.entries(headers);
  const get = (name: string) => entries.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
  const userAgent = get("user-agent");
  const extraOptions: string[] = [];
  const referer = get("referer") || get("referrer");
  const cookie = get("cookie");
  if (referer) extraOptions.push(`--http-referrer=${referer}`);
  if (cookie) extraOptions.push(`--http-cookie=${cookie}`);
  return { userAgent, extraOptions: extraOptions.length ? extraOptions : undefined };
}

interface Props {
  source: string; autoplay?: boolean; contentFit?: "contain" | "cover" | "fill";
  onError?: (msg: string) => void;
  onLoad?: (info: { duration?: number; width?: number; height?: number }) => void;
  onPlayingChange?: (playing: boolean) => void;
  onProgress?: (currentTime: number, duration: number) => void;
  headers?: Record<string, string>; style?: any;
}

export const SmartVideoPlayer = forwardRef<SmartVideoRef, Props>(function SmartVideoPlayer({
  source, autoplay = true, contentFit = "contain", onError, onLoad,
  onPlayingChange, onProgress, headers, style,
}, ref) {
  const [engine, setEngine] = useState<Engine>("exo");
  const [exoError, setExoError] = useState<string | null>(null);
  const [vlcCurrentTime, setVlcCurrentTime] = useState(0);
  const [vlcDuration, setVlcDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const fallbackUsed = useRef(false);
  const vlcRef = useRef<VlcPlayerHandle>(null);
  const vlcHeaders = vlcHeaderOptions(headers);

  const exoSource = headers && Object.keys(headers).length ? { uri: source, headers } : source;
  const exoPlayer = useVideoPlayer(exoSource as any, p => {
    p.loop = false;
    if (autoplay) p.play();
  });

  useEffect(() => {
    fallbackUsed.current = false;
    setEngine("exo"); setExoError(null); setVlcCurrentTime(0); setVlcDuration(0); setRate(1);
  }, [source]);

  useEffect(() => {
    if (!exoPlayer) return;
    const statusSub = exoPlayer.addListener("statusChange", (event: any) => {
      if (event?.error) {
        const msg = String(event.error?.message || event.error || "ExoPlayer oynatma hatası");
        setExoError(msg);
        if (!fallbackUsed.current) {
          fallbackUsed.current = true;
          try { exoPlayer.pause(); } catch {}
          setEngine("vlc");
        } else onError?.(msg);
      } else if (event?.status === "readyToPlay") {
        onLoad?.({
          duration: Number((exoPlayer as any).duration || 0),
          width: (exoPlayer as any).videoSize?.width,
          height: (exoPlayer as any).videoSize?.height,
        });
      }
    });
    const playingSub = exoPlayer.addListener("playingChange", (event: any) => onPlayingChange?.(!!event?.isPlaying));
    return () => { statusSub.remove(); playingSub.remove(); };
  }, [exoPlayer, onError, onLoad, onPlayingChange]);

  useEffect(() => {
    if (engine !== "exo" || !exoPlayer) return;
    const id = setInterval(() => {
      const cur = Number((exoPlayer as any).currentTime || 0);
      const dur = Number((exoPlayer as any).duration || 0);
      if (dur > 0) onProgress?.(cur, dur);
    }, 1000);
    return () => clearInterval(id);
  }, [engine, exoPlayer, onProgress]);

  useImperativeHandle(ref, () => ({
    play: () => engine === "exo" ? exoPlayer?.play() : vlcRef.current?.play(),
    pause: () => engine === "exo" ? exoPlayer?.pause() : vlcRef.current?.pause(),
    seekBy: sec => {
      if (engine === "exo") (exoPlayer as any).currentTime = Math.max(0, Number((exoPlayer as any).currentTime || 0) + sec);
      else vlcRef.current?.seek(Math.max(0, vlcCurrentTime + sec) * 1000, "time");
    },
    setRate: next => {
      const safe = Math.max(0.25, Math.min(4, next)); setRate(safe);
      if (engine === "exo") (exoPlayer as any).playbackRate = safe;
    },
    currentTime: () => engine === "exo" ? Number((exoPlayer as any)?.currentTime || 0) : vlcCurrentTime,
    duration: () => engine === "exo" ? Number((exoPlayer as any)?.duration || 0) : vlcDuration,
    currentEngine: () => engine,
    switchToVLC: () => { fallbackUsed.current = true; try { exoPlayer?.pause(); } catch {}; setEngine("vlc"); },
    replay: () => {
      if (engine === "exo") { (exoPlayer as any).currentTime = 0; exoPlayer?.play(); }
      else { vlcRef.current?.seek(0, "time"); vlcRef.current?.play(); }
    },
  }), [engine, exoPlayer, vlcCurrentTime, vlcDuration]);

  return <View style={[styles.container, style]}>
    {engine === "exo" ? (
      <VideoView player={exoPlayer} style={StyleSheet.absoluteFill} contentFit={contentFit} nativeControls={false} />
    ) : (
      <VLCPlayer
        ref={vlcRef}
        uri={source}
        paused={!autoplay}
        rate={rate}
        contentFit={contentFit}
        userAgent={vlcHeaders.userAgent}
        extraOptions={vlcHeaders.extraOptions}
        onTimeChanged={(ms: number) => { const cur=ms/1000; setVlcCurrentTime(cur); if(vlcDuration>0) onProgress?.(cur,vlcDuration); }}
        onFirstPlay={(info: any) => { const dur=Number(info?.length||0)/1000; setVlcDuration(dur); onLoad?.({duration:dur,width:info?.width,height:info?.height}); onPlayingChange?.(true); }}
        onPlaying={() => onPlayingChange?.(true)}
        onPaused={() => onPlayingChange?.(false)}
        onError={(msg: string) => onError?.(msg)}
      />
    )}
    {engine === "vlc" && exoError ? <View style={styles.badge}><Text style={styles.badgeText}>VLC MOTORU</Text></View> : null}
  </View>;
});
const styles=StyleSheet.create({container:{flex:1,backgroundColor:"#000"},badge:{position:"absolute",top:20,right:20,backgroundColor:"rgba(229,10,20,.9)",paddingHorizontal:10,paddingVertical:4,borderRadius:12},badgeText:{color:"#fff",fontSize:10,fontWeight:"900",letterSpacing:1.5}});
