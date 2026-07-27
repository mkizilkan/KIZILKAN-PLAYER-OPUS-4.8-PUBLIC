import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Platform,
  Modal,
  ScrollView,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, runOnJS } from "react-native-reanimated";
import { useTheme } from "@/src/theme/ThemeContext";
import { SPACING, RADIUS, FONT } from "@/src/theme/themes";
import { usePlaylists } from "@/src/store/PlaylistContext";
import { useLibrary } from "@/src/store/LibraryContext";
import { storage } from "@/src/utils/storage";
import { haptic } from "@/src/utils/haptic";
import { CastButton } from "@/src/components/CastButton";
import { VLCPlayer as VLCPlayerLib } from "@/src/native/vlc";

const EPISODE_URL_KEY = "kizilkan.episode.url.";
type Fit = "contain" | "cover" | "fill";
type SheetType = "sleep" | "audio" | "subtitle" | "speed" | "stats" | null;

const SLEEP_OPTIONS = [
  { label: "15 dakika", minutes: 15 },
  { label: "30 dakika", minutes: 30 },
  { label: "45 dakika", minutes: 45 },
  { label: "1 saat", minutes: 60 },
  { label: "2 saat", minutes: 120 },
];

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export default function PlayerScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; ext?: string }>();
  const { activePlaylist, toggleFavorite, isFavorite } = usePlaylists();
  const { setProgress: setLibProgress } = useLibrary();

  const [externalStream, setExternalStream] = useState<{ url: string; name: string; group: string; container_ext: string; poster?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [fit, setFit] = useState<Fit>("contain");
  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  // VLC medyası sarılabilir mi (canlı yayında false) — seek çökme koruması için.
  const [isSeekable, setIsSeekable] = useState(false);
  const [sheet, setSheet] = useState<SheetType>(null);
  const [sleepAt, setSleepAt] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState<string>("");
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number | undefined>(undefined);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState<number | undefined>(undefined);
  const [selectedAudio, setSelectedAudio] = useState<any | null>(null);
  const [selectedSubtitle, setSelectedSubtitle] = useState<any | null>(null);
  const [recordFlash, setRecordFlash] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(1.0);
  const [gestureFlash, setGestureFlash] = useState<string | null>(null);
  const [videoStats, setVideoStats] = useState<{ width?: number; height?: number; duration?: number; currentTime?: number; position?: number }>({});
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reanimated shared values for gesture visual feedback (unused for now but reserved)
  const _seekPreview = useSharedValue(0);
  const _speedIndicator = useSharedValue(0);

  // Dual-engine state: switch to VLC on ExoPlayer error (native only)
  const [useVLC, setUseVLC] = useState(false);
  const vlcRef = useRef<any>(null);

  useEffect(() => {
    if (params.ext === "true" && params.id) {
      storage.getItem<string>(EPISODE_URL_KEY + params.id, "").then(raw => {
        if (raw) {
          try { setExternalStream(JSON.parse(raw)); } catch {}
        }
      });
    }
  }, [params.id, params.ext]);

  const channel = useMemo(() => {
    if (externalStream) {
      return {
        id: params.id as string,
        name: externalStream.name,
        group: externalStream.group,
        url: externalStream.url,
        container_ext: externalStream.container_ext,
      } as any;
    }
    return activePlaylist?.channels.find(c => c.id === params.id) || null;
  }, [externalStream, activePlaylist, params.id]);

  const isSynthetic = params.ext === "true";

  /**
   * MPEG-TS yayınlarda DOĞRUDAN VLC ile başla (v4.8.2).
   * ExoPlayer HTTP üzerinden gelen .ts canlı yayınlarını çoğu zaman açamaz;
   * önce exo denenince kullanıcı boş ekran + hata görüp ancak sonra VLC'ye
   * düşüyordu. Kaynak .ts ise baştan güçlü motoru kullanıyoruz.
   */
  useEffect(() => {
    if (!channel?.url || useVLC || Platform.OS === "web" || !VLCPlayerLib) return;
    const u = String(channel.url).toLowerCase();
    const ext = String((channel as any).container_ext || "").toLowerCase();
    if (u.endsWith(".ts") || u.includes(".ts?") || ext === "ts") {
      setUseVLC(true);
    }
  }, [channel?.url, useVLC]);
  const supportsCatchup = !isSynthetic && channel?.tv_archive === 1 && activePlaylist?.source === "xtream";

  const player = useVideoPlayer(channel?.url ?? null, (p) => {
    p.loop = false;
    p.play();
  });

  // Track player status
  useEffect(() => {
    if (!player) return;
    const sub = player.addListener("statusChange", (event: any) => {
      // Gerçek yükleme durumları: spinner AÇ. readyToPlay'de aşağıda kapanır.
      if (event?.status === "loading" || event?.status === "buffering") {
        setIsBuffering(true);
      }
      if (event?.error) {
        const raw = event.error?.message || String(event.error);
        // ExoPlayer failed → try VLC fallback (native only)
        if (!useVLC && VLCPlayerLib && Platform.OS !== "web") {
          setUseVLC(true);
          // exo motorunu TAM serbest bırak: sadece pause yeterli değil — player
          // nesnesi ses odağını ve kod çözücüyü tutmaya devam eder, bu da VLC'de
          // SESSİZ oynatmaya yol açar. Kaynağı boşaltarak odağı bırakıyoruz.
          try { player.pause(); } catch {}
          try { (player as any).replace?.(null); } catch {}
          setError(null);
          return;
        }
        const ext = (channel?.container_ext || "").toLowerCase();
        const url = (channel?.url || "").toLowerCase();
        let hint = "";
        if (/cleartext/i.test(raw) || /security policy/i.test(raw)) {
          hint = "\n\nÇözüm: Uygulamayı yeniden derleyin (usesCleartextTraffic=true kuruldu).";
        } else if (ext === "avi" || url.endsWith(".avi")) {
          hint = "\n\nAVI formatı sınırlı destekle çalışır. MP4/MKV/M3U8 önerilir.";
        } else if (ext === "wmv" || ext === "flv") {
          hint = `\n\n${ext.toUpperCase()} format nadir olarak desteklenir. Sağlayıcınızdan MP4/HLS isteyin.`;
        } else if (/timeout|timed out/i.test(raw)) {
          hint = "\n\nSunucu yanıt vermiyor. Farklı bir kanal deneyin.";
        } else if (/404|not found/i.test(raw)) {
          hint = "\n\nKanal bulunamadı (404). Liste güncel olmayabilir.";
        } else if (/403|forbidden/i.test(raw)) {
          hint = "\n\nErişim engellendi (403). Abonelik süresi/eş zamanlı bağlantı sınırı dolmuş olabilir.";
        } else if (/network|connect/i.test(raw)) {
          hint = "\n\nAğ hatası. VPN veya farklı Wi-Fi deneyin.";
        }
        setError(raw + hint);
      } else if (event?.status === "readyToPlay") {
        setError(null);
        setIsBuffering(false);   // Hazır: spinner KAPAT
        try {
          const at = (player as any).availableAudioTracks || [];
          const st = (player as any).availableSubtitleTracks || [];
          if (Array.isArray(at)) setAudioTracks(at);
          if (Array.isArray(st)) setSubtitleTracks(st);
          const vs = (player as any).videoSize || (player as any).naturalSize || {};
          setVideoStats(prev => ({
            ...prev,
            width: vs?.width,
            height: vs?.height,
            duration: (player as any).duration || 0,
          }));
        } catch {}
      }
    });
    const psub = player.addListener("playingChange", (e: any) => {
      setIsPlaying(!!e?.isPlaying);
    });
    return () => { sub.remove(); psub.remove(); };
  }, [player]);

  // Poll currentTime for progress tracking (VOD/Series only)
  useEffect(() => {
    if (!player || !channel) return;
    if (!isSynthetic) return; // only track for VOD/series playback (they use synthetic ids)
    const interval = setInterval(() => {
      try {
        const cur = (player as any).currentTime;
        const dur = (player as any).duration;
        if (typeof cur === "number" && typeof dur === "number" && dur > 0 && cur > 3) {
          const realId = String(params.id || "").replace(/^(vodplay-|epplay-)/, "");
          const kind: "vod" | "series" = String(params.id || "").startsWith("epplay-") ? "series" : "vod";
          setLibProgress(realId, {
            current: cur,
            duration: dur,
            kind,
            name: channel.name,
            poster: externalStream?.poster,
          }).catch(() => {});
          setVideoStats(prev => ({ ...prev, currentTime: cur, duration: dur }));
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [player, channel, isSynthetic, params.id, setLibProgress, externalStream]);

  // Orientation handling: allow both portrait & landscape, user controls
  const [locked, setLocked] = useState<"landscape" | "portrait" | "auto">("auto");

  useEffect(() => {
    (async () => {
      try {
        // Unlock so the phone can rotate freely
        await ScreenOrientation.unlockAsync();
      } catch {}
    })();
    return () => {
      // Restore portrait on exit
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT).catch(() => {});
    };
  }, []);

  const applyLock = async (mode: "landscape" | "portrait" | "auto") => {
    setLocked(mode);
    try {
      if (mode === "landscape") await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      else if (mode === "portrait") await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      else await ScreenOrientation.unlockAsync();
    } catch {}
    revealControls();
  };

  // Sleep timer tick
  useEffect(() => {
    if (!sleepAt) { setSleepRemaining(""); return; }
    const tick = () => {
      const ms = sleepAt - Date.now();
      if (ms <= 0) {
        // fire
        try { player?.pause(); } catch {}
        setSleepAt(null);
        setSleepRemaining("");
        goBack();
        return;
      }
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      setSleepRemaining(`${mins}:${String(secs).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepAt]);

  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  };
  useEffect(() => { scheduleHide(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, []);
  const revealControls = () => { setShowControls(true); scheduleHide(); };

  const togglePlay = () => {
    if (useVLC) {
      // VLC modunda vlcRef'i kontrol et.
      if (isPlaying) vlcRef.current?.pause(); else vlcRef.current?.play();
      setIsPlaying(!isPlaying);
      revealControls();
      return;
    }
    if (!player) return;
    if (isPlaying) player.pause(); else player.play();
    revealControls();
  };

  const seekBy = (delta: number) => {
    if (useVLC) {
      // VLC: zaman ms cinsinden. Mevcut konum videoStats.position (saniye).
      // ÇÖKME KORUMASI: sarılamayan (canlı) medyada setTime çağırmak native
      // tarafta sorun çıkarabiliyor; sadece seekable ise sar.
      if (!isSeekable) {
        flashMessage("Bu yayında ileri/geri alınamaz");
        return;
      }
      try {
        const curSec = videoStats.position || 0;
        const targetMs = Math.max(0, (curSec + delta) * 1000);
        vlcRef.current?.seek(targetMs, "time");
      } catch { /* native hata yutulur, çökme olmaz */ }
      revealControls();
      return;
    }
    if (!player) return;
    try {
      const cur = (player as any).currentTime || 0;
      (player as any).currentTime = Math.max(0, cur + delta);
    } catch {}
    revealControls();
  };

  const cycleFit = () => {
    setFit(prev => prev === "contain" ? "cover" : prev === "cover" ? "fill" : "contain");
    revealControls();
  };

  const setSleep = (minutes: number | null) => {
    if (sleepTimer.current) { clearTimeout(sleepTimer.current); sleepTimer.current = null; }
    if (minutes === null) {
      setSleepAt(null);
      setSleepRemaining("");
    } else {
      setSleepAt(Date.now() + minutes * 60 * 1000);
    }
    setSheet(null);
  };

  const selectAudio = (t: any) => {
    try { (player as any).audioTrack = t; setSelectedAudio(t); } catch {}
    setSheet(null);
  };
  const selectSubtitle = (t: any) => {
    try { (player as any).subtitleTrack = t; setSelectedSubtitle(t); } catch {}
    setSheet(null);
  };

  const setPlaybackSpeed = (rate: number) => {
    setSpeed(rate);
    try { (player as any).playbackRate = rate; } catch {}
    haptic.soft();
    setSheet(null);
  };

  const flashMessage = (msg: string) => {
    setGestureFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setGestureFlash(null), 800);
  };

  // Double-tap gestures: left = -10s, right = +10s
  // Only enable seek for VOD (synthetic ids)
  const canSeek = isSynthetic;
  const doubleTapSkip = (dir: "back" | "fwd") => {
    if (!canSeek) {
      flashMessage("Canlı yayında ileri/geri alınamaz");
      return;
    }
    haptic.medium();
    seekBy(dir === "fwd" ? 10 : -10);
    flashMessage(dir === "fwd" ? "⏭ +10s" : "⏮ -10s");
  };

  // Single tap: toggle controls
  const tapGesture = Gesture.Tap()
    .maxDuration(200)
    .onEnd(() => {
      runOnJS(revealControls)();
    });

  // ÇİFT DOKUNUŞ DÜZELTMESİ (P0-5):
  // ESKİ: iki ayrı jest (left/right) ikisi de TÜM ekranı kaplıyordu; Exclusive
  // hep ilkine (back) öncelik veriyordu -> her çift dokunuş -10s oluyordu.
  // YENİ: TEK jest, dokunma X konumuna göre yön belirler:
  //   ekranın sol yarısı -> geri (-10s), sağ yarısı -> ileri (+10s).
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd((e) => {
      // Player yatay/dikey olabilir; genişliği o an oku.
      const w = Dimensions.get("window").width;
      const isLeft = e.x < w / 2;
      runOnJS(doubleTapSkip)(isLeft ? "back" : "fwd");
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      runOnJS(setPlaybackSpeed)(2.0);
      runOnJS(flashMessage)("⏩ 2x hız");
    })
    .onEnd(() => {
      runOnJS(setPlaybackSpeed)(1.0);
    });

  const goBack = async () => {
    try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT); } catch {}
    router.back();
  };

  const openCatchup = () => {
    if (!channel) return;
    router.replace({ pathname: "/catchup", params: { channel: channel.id } });
  };

  if (!channel) {
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        <Text style={{ color: "#fff" }}>Kanal bulunamadı</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]} testID="player-screen">
      <StatusBar hidden />
      <GestureDetector gesture={Gesture.Exclusive(doubleTapGesture, longPressGesture, tapGesture)}>
        <Animated.View style={StyleSheet.absoluteFill}>
          {!useVLC && (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit={fit}
              nativeControls={false}
              allowsFullscreen={false}
              allowsPictureInPicture={Platform.OS === "ios"}
            />
          )}
          {useVLC && VLCPlayerLib && (
            <VLCPlayerLib
              ref={vlcRef}
              uri={channel.url}
              contentFit={fit}
              rate={speed}
              onPlaying={() => { setIsPlaying(true); setIsBuffering(false); }}
              onPaused={() => setIsPlaying(false)}
              onBuffering={(progress: number) => {
                // Gerçek buffer göstergesi: %100'de kapan.
                setIsBuffering(progress < 100);
              }}
              onError={(message: string) => {
                // libVLC çoğu zaman tek bir jenerik metin verir
                // ("Player encountered an error"). Bunu kullanıcıya olduğu gibi
                // göstermek işe yaramıyor; anlamlı ve eyleme dönük hale getir.
                const low = String(message).toLowerCase();
                let text: string;
                if (/invalid source/.test(low)) {
                  text = "Yayın adresi geçersiz. Liste güncellenmeli olabilir.";
                } else if (/cleartext|http traffic|not permitted|security/.test(low)) {
                  text = "Şifresiz (http) yayın engellendi. Sunucu erişime izin vermiyor olabilir.";
                } else if (/403|forbidden/.test(low)) {
                  text = "Erişim engellendi (403). Eş zamanlı bağlantı sınırınız dolmuş olabilir — başka cihazda açık oturumu kapatın.";
                } else if (/404|not found/.test(low)) {
                  text = "Kanal bulunamadı (404). Listeyi güncelleyin.";
                } else if (/timeout|timed out|connect|network/.test(low)) {
                  text = "Sunucuya ulaşılamadı. İnternetinizi veya başka bir kanalı deneyin.";
                } else {
                  // Jenerik libVLC hatası — en sık sebepler sırayla.
                  text =
                    "Yayın açılamadı.\n\n" +
                    "Olası sebepler:\n" +
                    "• Kanal sunucusu şu an yanıt vermiyor\n" +
                    "• Eş zamanlı bağlantı sınırı dolmuş olabilir\n" +
                    "• Bu kanal listede artık geçerli değil\n\n" +
                    "«Tekrar Dene» veya başka bir kanal deneyin.";
                }
                setError(text);
              }}
              onTimeChanged={(ms: number) => {
                setVideoStats(prev => ({ ...prev, position: Math.floor(ms / 1000) }));
              }}
              onTracks={(t: any) => {
                // Parça listesini sakla (ADIM 2b'de seçim menüsüne verilecek).
                if (Array.isArray(t.audio)) setAudioTracks(t.audio);
                if (Array.isArray(t.subtitle)) setSubtitleTracks(t.subtitle);
              }}
              onFirstPlay={(info: any) => {
                setIsSeekable(!!info.seekable);
                setVideoStats(prev => ({
                  ...prev, width: info.width, height: info.height, duration: Math.floor((info.length || 0) / 1000),
                }));
              }}
            />
          )}
        </Animated.View>
      </GestureDetector>

      {gestureFlash && (
        <View style={styles.gestureFlash} pointerEvents="none">
          <Text style={styles.gestureFlashText}>{gestureFlash}</Text>
        </View>
      )}

      {recordFlash && (
        <View style={styles.recordFlash} pointerEvents="none">
          <Ionicons name="recording" size={16} color="#fff" />
          <Text style={styles.recordFlashText}>{recordFlash}</Text>
        </View>
      )}

      {error && (
        <View style={styles.overlayCenter} pointerEvents="box-none">
          <Ionicons name="warning" size={40} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            testID="player-retry-btn"
            onPress={() => {
              setError(null);
              setIsBuffering(true);
              if (useVLC) {
                // VLC modunda: durdurup yeniden başlat.
                try { vlcRef.current?.stop(); } catch {}
                setTimeout(() => { try { vlcRef.current?.play(); } catch {} }, 250);
              } else {
                try { (player as any)?.replay?.(); } catch {}
              }
            }}
            style={[styles.retryBtn, { backgroundColor: colors.brandPrimary }]}
          >
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {showControls && (
        <>
          <View style={styles.topBar} pointerEvents="box-none">
            <TouchableOpacity testID="player-back-btn" onPress={goBack} style={styles.iconBtn} hitSlop={12}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.channelName} numberOfLines={1}>{channel.name}</Text>
              <Text style={styles.channelMeta} numberOfLines={1}>
                {channel.group || "Live"} • {channel.container_ext?.toUpperCase() || "STREAM"}
                {useVLC ? " • VLC" : ""}
                {sleepRemaining ? ` • 🌙 ${sleepRemaining}` : ""}
              </Text>
            </View>
            <View style={styles.iconBtn}>
              <CastButton
                testID="player-cast-btn"
                source={{ url: channel.url, name: channel.name, poster: (channel as any).logo, contentType: channel.container_ext ? undefined : "video/mp4" }}
                size={22}
                color="#fff"
              />
            </View>
            <TouchableOpacity
              testID="player-rotate-btn"
              onPress={() => applyLock(locked === "landscape" ? "portrait" : locked === "portrait" ? "auto" : "landscape")}
              style={styles.iconBtn}
              hitSlop={8}
            >
              <Ionicons
                name={locked === "landscape" ? "phone-landscape" : locked === "portrait" ? "phone-portrait" : "sync"}
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
            {!isSynthetic && (
              <TouchableOpacity
                testID="player-fav-btn"
                onPress={() => toggleFavorite(channel.id)}
                style={styles.iconBtn}
                hitSlop={10}
              >
                <Ionicons
                  name={isFavorite(channel.id) ? "heart" : "heart-outline"}
                  size={24}
                  color={isFavorite(channel.id) ? colors.brandPrimary : "#fff"}
                />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.centerCtrl} pointerEvents="box-none">
            <TouchableOpacity testID="player-seek-back-btn" onPress={() => seekBy(-10)} style={styles.seekBtn}>
              <Ionicons name="play-back" size={26} color="#fff" />
              <Text style={styles.seekLabel}>10s</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="player-playpause-btn" onPress={togglePlay} style={styles.playBtn} activeOpacity={0.7}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={38} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity testID="player-seek-fwd-btn" onPress={() => seekBy(10)} style={styles.seekBtn}>
              <Ionicons name="play-forward" size={26} color="#fff" />
              <Text style={styles.seekLabel}>10s</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomBar} pointerEvents="box-none">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bottomRow}>
              <ActionBtn testID="player-fit-btn" icon="resize" label={fit === "contain" ? "Sığdır" : fit === "cover" ? "Doldur" : "Uzat"} onPress={cycleFit} />
              <ActionBtn testID="player-speed-btn" icon="speedometer" label={`${speed.toFixed(2)}x`} onPress={() => setSheet("speed")} highlighted={speed !== 1.0} />
              <ActionBtn testID="player-audio-btn" icon="musical-notes" label={audioTracks.length > 0 ? `Ses (${audioTracks.length})` : "Ses"} onPress={() => setSheet("audio")} />
              <ActionBtn testID="player-subtitle-btn" icon="text" label={subtitleTracks.length > 0 ? `Altyazı (${subtitleTracks.length})` : "Altyazı"} onPress={() => setSheet("subtitle")} />
              <ActionBtn testID="player-sleep-btn" icon="moon" label={sleepAt ? "Zamanlayıcı Aç" : "Uyku"} onPress={() => setSheet("sleep")} highlighted={!!sleepAt} />
              <ActionBtn testID="player-stats-btn" icon="analytics" label="Bilgi" onPress={() => setSheet("stats")} />
              {supportsCatchup && (
                <ActionBtn testID="player-catchup-btn" icon="play-back-circle" label="Catch-up" onPress={openCatchup} />
              )}
              {!isSynthetic && (
                <ActionBtn
                  testID="player-record-btn"
                  icon="radio-button-on"
                  label="Kaydet"
                  onPress={async () => {
                    try {
                      const api = (await import("@/src/utils/api")).api;
                      const now = new Date();
                      const stop = new Date(now.getTime() + 60 * 60 * 1000);
                      await api.dvrSchedule({
                        playlist_id: activePlaylist?.id || "",
                        channel_id: channel.id,
                        channel_name: channel.name,
                        start_iso: now.toISOString(),
                        stop_iso: stop.toISOString(),
                        title: `${channel.name} - ${now.toLocaleString("tr-TR")}`,
                      });
                      setRecordFlash("Kayıt planlandı ✓ (native modül ile publish sonrası aktif)");
                      setTimeout(() => setRecordFlash(null), 4000);
                    } catch (e: any) {
                      setRecordFlash("Kayıt planlanamadı: " + (e?.message || "hata"));
                      setTimeout(() => setRecordFlash(null), 4000);
                    }
                  }}
                />
              )}
              <ActionBtn testID="player-reload-btn" icon="refresh" label="Yenile" onPress={() => { try { (player as any)?.replay?.(); } catch {} }} />
            </ScrollView>
          </View>
        </>
      )}

      {!error && (
        <View style={styles.spinnerOverlay} pointerEvents="none">
          {isBuffering && <ActivityIndicator size="large" color={colors.brandPrimary} />}
        </View>
      )}

      {/* Bottom Sheet */}
      <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheet(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.onSurfaceTertiary }]} />
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>
              {sheet === "sleep" ? "Uyku Zamanlayıcısı"
                : sheet === "audio" ? "Ses Parçası"
                : sheet === "speed" ? "Oynatma Hızı"
                : sheet === "stats" ? "Yayın Bilgisi"
                : "Altyazı"}
            </Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {sheet === "speed" && SPEED_OPTIONS.map(rate => (
                <SheetItem
                  key={rate}
                  testID={`speed-${rate}-btn`}
                  label={rate === 1.0 ? "Normal (1.0x)" : `${rate.toFixed(rate < 1 ? 2 : 1)}x${rate === 2.0 ? " ⏩" : ""}`}
                  icon="speedometer"
                  onPress={() => setPlaybackSpeed(rate)}
                  active={speed === rate}
                />
              ))}
              {sheet === "stats" && (
                <View style={styles.statsCard}>
                  <StatsRow label="Ad" value={channel.name} />
                  <StatsRow label="Grup" value={channel.group || "-"} />
                  <StatsRow label="Format" value={(channel.container_ext || "?").toUpperCase()} />
                  {videoStats.width && videoStats.height ? (
                    <StatsRow label="Çözünürlük" value={`${videoStats.width} × ${videoStats.height}`} />
                  ) : null}
                  {videoStats.duration ? (
                    <StatsRow
                      label="Süre"
                      value={
                        videoStats.currentTime && videoStats.duration
                          ? `${fmtTime(videoStats.currentTime)} / ${fmtTime(videoStats.duration)}`
                          : fmtTime(videoStats.duration)
                      }
                    />
                  ) : null}
                  <StatsRow label="Hız" value={`${speed.toFixed(2)}x`} />
                  <StatsRow label="Ses Parçası" value={selectedAudio?.label || selectedAudio?.language || "Varsayılan"} />
                  <StatsRow label="Altyazı" value={selectedSubtitle?.label || selectedSubtitle?.language || "Kapalı"} />
                  <StatsRow label="URL" value={channel.url?.slice(0, 60) + "..."} mono />
                </View>
              )}
              {sheet === "sleep" && (
                <>
                  {SLEEP_OPTIONS.map(opt => (
                    <SheetItem
                      key={opt.minutes}
                      testID={`sleep-${opt.minutes}-btn`}
                      label={opt.label}
                      icon="moon"
                      onPress={() => setSleep(opt.minutes)}
                    />
                  ))}
                  {sleepAt && (
                    <SheetItem
                      testID="sleep-cancel-btn"
                      label="Zamanlayıcıyı İptal Et"
                      icon="close-circle"
                      onPress={() => setSleep(null)}
                      danger
                    />
                  )}
                </>
              )}
              {sheet === "audio" && (
                audioTracks.length === 0 ? (
                  <Text style={[styles.emptySheet, { color: colors.onSurfaceSecondary }]}>Bu yayında ek ses parçası yok</Text>
                ) : (
                  audioTracks.map((t, i) => (
                    <SheetItem
                      key={i}
                      testID={`audio-track-${i}-btn`}
                      label={t.label || t.language || `Parça ${i + 1}`}
                      icon="musical-notes"
                      onPress={() => selectAudio(t)}
                      active={selectedAudio === t}
                    />
                  ))
                )
              )}
              {sheet === "subtitle" && (
                <>
                  <SheetItem
                    testID="subtitle-off-btn"
                    label="Kapat"
                    icon="close-circle"
                    onPress={() => selectSubtitle(null)}
                    active={selectedSubtitle === null}
                  />
                  {subtitleTracks.length === 0 ? (
                    <Text style={[styles.emptySheet, { color: colors.onSurfaceSecondary }]}>Bu yayında altyazı yok</Text>
                  ) : (
                    subtitleTracks.map((t, i) => (
                      <SheetItem
                        key={i}
                        testID={`subtitle-track-${i}-btn`}
                        label={t.label || t.language || `Altyazı ${i + 1}`}
                        icon="text"
                        onPress={() => selectSubtitle(t)}
                        active={selectedSubtitle === t}
                      />
                    ))
                  )}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ActionBtn({ testID, icon, label, onPress, highlighted }: { testID: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; highlighted?: boolean }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} focusable style={styles.actionBtn}>
      <Ionicons name={icon} size={20} color={highlighted ? "#FFCA28" : "#fff"} />
      <Text style={[styles.actionText, highlighted && { color: "#FFCA28" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SheetItem({ testID, label, icon, onPress, active, danger }: { testID: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; active?: boolean; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.7} focusable
      style={[styles.sheetItem, { borderColor: colors.border }, active && { backgroundColor: colors.surfaceSecondary }]}>
      <Ionicons name={icon} size={20} color={danger ? colors.error : active ? colors.brandPrimary : colors.onSurface} />
      <Text style={[styles.sheetItemText, { color: danger ? colors.error : active ? colors.brandPrimary : colors.onSurface }]}>{label}</Text>
      {active && <Ionicons name="checkmark" size={20} color={colors.brandPrimary} />}
    </TouchableOpacity>
  );
}

function StatsRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statsRow}>
      <Text style={[styles.statsLabel, { color: colors.onSurfaceSecondary }]}>{label}</Text>
      <Text
        style={[styles.statsValue, { color: colors.onSurface, fontFamily: mono ? Platform.select({ ios: "Courier", android: "monospace" }) : undefined }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  channelName: { color: "#fff", fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
  channelMeta: { color: "#B3B3B3", fontSize: FONT.size.xs, marginTop: 2 },
  iconBtn: { padding: SPACING.xs },
  centerCtrl: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.xl,
  },
  playBtn: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.35)",
  },
  seekBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  seekLabel: { color: "#fff", fontSize: 9, fontWeight: FONT.weight.bold, marginTop: -2 },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: SPACING.sm,
  },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.lg },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  actionText: { color: "#fff", fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  overlayCenter: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    padding: SPACING.xl, gap: SPACING.md,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  errorText: { color: "#fff", fontSize: FONT.size.base, textAlign: "center" },
  retryBtn: { paddingHorizontal: SPACING.xl, height: 44, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
  retryText: { color: "#fff", fontWeight: FONT.weight.bold, fontSize: FONT.size.base },
  spinnerOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
  },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { padding: SPACING.lg, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, borderWidth: 1, gap: SPACING.md },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: SPACING.sm },
  sheetTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, marginBottom: SPACING.sm },
  sheetItem: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, marginBottom: SPACING.xs,
  },
  sheetItemText: { flex: 1, fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
  emptySheet: { textAlign: "center", fontSize: FONT.size.base, padding: SPACING.lg },
  recordFlash: {
    position: "absolute", top: 70, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(229,9,20,0.95)",
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
  },
  recordFlashText: { color: "#fff", fontWeight: FONT.weight.bold, fontSize: FONT.size.sm },
  gestureFlash: {
    position: "absolute", top: "45%", alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
  },
  gestureFlashText: { color: "#fff", fontWeight: FONT.weight.black, fontSize: FONT.size.xl },
  statsCard: { paddingVertical: SPACING.sm },
  statsRow: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.08)",
  },
  statsLabel: { flex: 0.4, fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  statsValue: { flex: 0.6, fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
});
