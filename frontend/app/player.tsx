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
  TextInput,
  Alert,
  useWindowDimensions,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { SeekBar, formatTime as fmtDur } from "@/src/components/SeekBar";
import { useTv } from "@/src/store/TvContext";
import { useTVFocus } from "@/src/hooks/useTVFocus";
import { FocusButton } from "@/src/components/FocusButton";
import { useRemoteKeys } from "@/src/hooks/useRemoteKeys";
import { testStream, DEFAULT_USER_AGENT } from "@/src/utils/streamTest";
import { loadOverrides, type OverrideMap } from "@/src/utils/overrides";
import { BackHandler } from "react-native";
import { VLCPlayer as VLCPlayerLib } from "@/src/native/vlc";

const EPISODE_URL_KEY = "kizilkan.episode.url.";
type Fit = "contain" | "cover" | "fill";
type SheetType = "sleep" | "audio" | "subtitle" | "speed" | "stats" | "buffer" | "engine" | "audiodelay" | "jump" | null;

/** Ağ tamponu seçenekleri (ms). Yüksek = daha az takılma, daha geç açılış. */
/**
 * TAMPON SEÇENEKLERİ
 * v7.7.0: 0 ve 300 ms eklendi (kullanıcı isteği: "tampon yok").
 *
 * DÜRÜST NOT: libVLC'de tampon TAMAMEN sıfırlanamaz — 0 verildiğinde
 * kütüphane kendi asgari değerine (~100-200 ms) düşer. Bu yüzden seçeneğin
 * adı "Tampon yok" değil "En düşük"; abartılı bir vaat vermiyoruz.
 * Canlı/feed yayınlarda gecikmeyi en aza indirir ama takılma riski artar.
 */
const BUFFER_OPTIONS = [0, 300, 1000, 1500, 2500, 4000, 6000];
const BUFFER_KEY = "kizilkan.player.buffer";
const ENGINE_KEY = "kizilkan.player.engine";   // "auto" | "vlc" | "exo"

/**
 * MOTOR HAFIZASI (v7.3.0)
 * ---------------------------------------------------------------------------
 * SORUN: "Otomatik" modda her açılışta aynı deneme-yanılma yaşanıyordu:
 * ExoPlayer dene -> olmadı -> VLC'ye düş. Kullanıcı her seferinde 3-5 saniye
 * bekliyordu; oysa o kanalın hangi motorla açıldığı zaten biliniyordu.
 *
 * ÇÖZÜM: Bir kanal SORUNSUZ oynadığında, hangi motorla oynadığı kaydedilir.
 * Aynı kanal tekrar açıldığında doğrudan o motorla başlar — bekleme biter.
 * Kayıt kanal kimliğine göre tutulur ve hata olursa temizlenir.
 */
/**
 * TV mi? (senkron ilk tahmin)
 * useTv() bir hook olduğu için useState başlangıcında kullanılamaz.
 * Bu yüzden ilk değer için ekran oranına bakan hafif bir tahmin kullanılıyor;
 * yanlış tahmin en fazla panelin bir kez görünmesine yol açar, işlev bozulmaz.
 */
function isTvInitial(): boolean {
  try {
    const { width, height } = require("react-native").Dimensions.get("window");
    // TV ekranları geniş ve yataydır; telefonlar dikey veya dar.
    return width >= 960 && width / height >= 1.6;
  } catch { return false; }
}

const engineMemoKey = (channelId: string) => `kizilkan.engineMemo.${channelId}`;
const HWACCEL_KEY = "kizilkan.player.hwaccel"; // true | false
const AUDIO_DELAY_KEY = "kizilkan.player.audioDelay"; // ms

/** Ses gecikmesi seçenekleri (ms). Negatif = ses erken gelsin. */
const AUDIO_DELAY_OPTIONS = [-1000, -500, -250, 0, 250, 500, 1000];

/** "Süreye Git" hızlı atlama adımları (saniye). */
const JUMP_STEPS = [-600, -300, -60, 60, 300, 600];

/** Yüzdeye atlama noktaları. */
const JUMP_PERCENTS = [10, 25, 50, 75, 90];

/**
 * "1:23:45", "23:45" veya "45" biçimindeki metni saniyeye çevirir.
 * Geçersizse null döner.
 */
function parseTimeInput(text: string): number | null {
  const t = (text || "").trim();
  if (!t) return null;
  // Sadece rakam ve : kabul
  if (!/^[0-9:]+$/.test(t)) return null;
  const parts = t.split(":").map(p => p.trim());
  if (parts.some(p => p === "" || Number.isNaN(Number(p)))) return null;
  const nums = parts.map(Number);
  let sec = 0;
  if (nums.length === 1) sec = nums[0];                                  // saniye
  else if (nums.length === 2) sec = nums[0] * 60 + nums[1];              // dk:sn
  else if (nums.length === 3) sec = nums[0] * 3600 + nums[1] * 60 + nums[2]; // sa:dk:sn
  else return null;
  return Number.isFinite(sec) && sec >= 0 ? Math.floor(sec) : null;
}

type Engine = "auto" | "vlc" | "exo";

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
  // Telefonun gezinme çubuğu/çentik alanı — kontroller altına gizlenmesin.
  const insets = useSafeAreaInsets();
  const { isTv, overscan } = useTv();
  const { width: screenW } = useWindowDimensions();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; ext?: string }>();
  const { activePlaylist, toggleFavorite, isFavorite } = usePlaylists();
  const { setProgress: setLibProgress } = useLibrary();

  const [externalStream, setExternalStream] = useState<{ url: string; name: string; group: string; container_ext: string; poster?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * KONTROL PANELİ BAŞLANGIÇ DURUMU (v8.6.0 — kullanıcı bildirimi)
   * SORUN: Her kanal açılışında ayar paneli (Exo/Ses/Altyazı/Tampon...)
   * ekranda beliriyordu. Hızlı kanal geçişinde bu çok rahatsız edici:
   * kullanıcı yayını değil menüyü görüyordu.
   * ÇÖZÜM: TV'de KAPALI başlar — kullanıcı OK tuşuna basınca açılır,
   * tekrar basınca kapanır. Telefonda dokunmatik olduğu için AÇIK başlar
   * (kullanıcı düğmelerin nerede olduğunu görsün).
   */
  /**
   * KONTROL PANELİ BAŞLANGIÇ (v9.1.0 — kullanıcı isteği)
   * Kanal açılışında ve zap sırasında ayar kutusu (Tampon/Kayıt/Altyazı...)
   * kendiliğinden çıkıyordu; kullanıcı yayını değil menüyü görüyordu.
   * ARTIK HER CİHAZDA KAPALI başlar. Kullanıcı ekrana dokununca
   * (TV'de OK'a basınca) açılır.
   */
  const [showControls, setShowControls] = useState(false);
  const [fit, setFit] = useState<Fit>("contain");
  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  // VLC medyası sarılabilir mi (canlı yayında false) — seek çökme koruması için.
  const [isSeekable, setIsSeekable] = useState(false);
  // Ağ tamponu (ms) — takılma yaşayan kullanıcı artırabilir.
  const [bufferMs, setBufferMs] = useState<number>(1500);

  // Oynatıcı motoru ve donanım hızlandırma — kullanıcı ayarı.
  const [engine, setEngine] = useState<Engine>("auto");
  const [hwAccel, setHwAccel] = useState(true);
  const [audioDelay, setAudioDelay] = useState(0);
  const [jumpText, setJumpText] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    storage.getItem<number>(BUFFER_KEY, 1500).then(v => {
      if (typeof v === "number" && v > 0) setBufferMs(v);
    });
    storage.getItem<string>(ENGINE_KEY, "auto").then(v => {
      if (v === "auto" || v === "vlc" || v === "exo") setEngine(v);
    });
    storage.getItem<boolean>(HWACCEL_KEY, true).then(v => {
      if (typeof v === "boolean") setHwAccel(v);
    });
    storage.getItem<number>(AUDIO_DELAY_KEY, 0).then(v => {
      if (typeof v === "number") setAudioDelay(v);
    });
  }, []);
  const [sheet, setSheet] = useState<SheetType>(null);
  const [sleepAt, setSleepAt] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState<string>("");
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
  // VLC parça seçimi: native taraf eksik alanları 0'a düşürdüğü için ÜÇÜ DE
  // gerçek id ile gönderilmeli (video id'si olmadan gönderirsek video kapanır).
  const [vlcVideoTrackId, setVlcVideoTrackId] = useState<number | undefined>(undefined);
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
  /**
   * KANAL BAŞINA AYARLAR (v7.3.0)
   * Kullanıcının bu kanal için tanımladığı özel User-Agent / Referer.
   * Bazı yayınlar bunlar olmadan açılmıyor.
   */
  const [overrides, setOverrides] = useState<OverrideMap>({});
  /**
   * STALKER YAYIN ADRESİ (v9.1.0)
   * MAG portallarında kanal listesindeki adres bir KOMUTTUR, doğrudan
   * oynatılamaz. Gerçek adres her açılışta create_link ile alınır ve
   * KISA SÜRELİDİR. Bu yüzden burada çözülüp oynatıcıya veriliyor.
   */
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);


  const [isRecording, setIsRecording] = useState(false);   // DVR kaydı (v7.3.0)
  const [recordStart, setRecordStart] = useState<number | null>(null);
  const [recordDirLabel, setRecordDirLabel] = useState("Uygulama klasörü");
  const [recordPath, setRecordPath] = useState<string | null>(null);   // onRecordChanged'dan
  const [customRecordDir, setCustomRecordDir] = useState<string | null>(null);
  const [recBlink, setRecBlink] = useState(true);  // kayıt başlangıcı (v7.5.0)
  /**
   * CANLI BİLGİ PANELİ (v7.5.0)
   * Bilgi paneli AÇIKKEN saniyede bir yenilenir; böylece süre, kayıt süresi
   * ve durum anlık görünür. Panel kapalıyken zamanlayıcı çalışmaz (pil dostu).
   */
  const [statsTick, setStatsTick] = useState(Date.now());
  /**
   * KAYDIRMA İLE SES KONTROLÜ (v7.7.0 — kullanıcı isteği)
   * Ekranın SAĞ yarısında parmağı yukarı/aşağı kaydırmak sesi ayarlar.
   * (Standart oynatıcı deseni: MX Player, VLC, YouTube hepsi böyle yapar.)
   *
   * PARLAKLIK NOTU: Sol yarıda parlaklık için expo-brightness paketi gerekir;
   * projede kurulu DEĞİL. Paket eklemek native derleme riskidir, bu yüzden
   * şimdilik SES uygulandı. Parlaklık istenirse ayrı bir adımda eklenebilir.
   */
  const [volume, setVolume] = useState(100);
  const [volumeHint, setVolumeHint] = useState<number | null>(null);
  const volumeStartRef = useRef(100);
  const volHintTimer = useRef<any>(null);
  /**
   * YAYIN (CAST) OTURUMU (v7.4.0)
   * TV'ye yayın yaparken telefondaki ileri/geri/duraklat düğmeleri LOKAL
   * oynatıcıyı kontrol ediyordu; TV'de hiçbir şey değişmiyordu.
   * Bağlıyken bu komutlar artık TV'deki oynatıcıya gönderiliyor.
   */
  const [castSession, setCastSession] = useState<any>(null);

  useEffect(() => {
    if (!activePlaylist?.id) return;
    let alive = true;
    loadOverrides(activePlaylist.id)
      .then(m => { if (alive) setOverrides(m || {}); })
      .catch(() => {});
    return () => { alive = false; };
  }, [activePlaylist?.id]);
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

  /**
   * OYNATILACAK ADRES
   * Stalker'da create_link ile çözülmüş geçici adres; diğerlerinde
   * kanalın kendi adresi.
   */
  const playUrl = resolvedUrl || channel?.url || null;

  useEffect(() => {
    // Stalker değilse çözüme gerek yok
    if (!channel?.url || activePlaylist?.source !== "stalker") { setResolvedUrl(null); return; }
    let alive = true;
    setResolving(true);
    (async () => {
      try {
        const { stalkerResolveStream, normalizeMac } = await import("@/src/utils/stalker");
        const pl: any = activePlaylist;
        const cred = {
          portal: pl.stalkerPortal,
          mac: normalizeMac(pl.stalkerMac || ""),
          serial: pl.stalkerSerial,
        };
        const { url } = await stalkerResolveStream(cred, null, String(channel.url));
        if (alive) setResolvedUrl(url);
      } catch (e: any) {
        if (alive) {
          setResolvedUrl(null);
          setError("Portal yayın adresi vermedi: " + String(e?.message || e));
        }
      } finally {
        if (alive) setResolving(false);
      }
    })();
    return () => { alive = false; };
  }, [channel?.url, activePlaylist?.id, activePlaylist?.source]);

  const isSynthetic = params.ext === "true";

  /**
   * MPEG-TS yayınlarda DOĞRUDAN VLC ile başla (v4.8.2).
   * ExoPlayer HTTP üzerinden gelen .ts canlı yayınlarını çoğu zaman açamaz;
   * önce exo denenince kullanıcı boş ekran + hata görüp ancak sonra VLC'ye
   * düşüyordu. Kaynak .ts ise baştan güçlü motoru kullanıyoruz.
   */
  useEffect(() => {
    if (!channel?.url || Platform.OS === "web" || !VLCPlayerLib) return;

    // Kullanıcı motoru elle seçtiyse ona uy.
    if (engine === "vlc") { if (!useVLC) setUseVLC(true); return; }
    if (engine === "exo") { return; } // exo'da kal (hata olursa yine VLC'ye düşer)

    // OTOMATİK: .ts yayınlarda doğrudan VLC (ExoPlayer bunları açamıyor).
    if (useVLC) return;
    const u = String(channel.url).toLowerCase();
    const ext = String((channel as any).container_ext || "").toLowerCase();
    if (u.endsWith(".ts") || u.includes(".ts?") || ext === "ts") {
      setUseVLC(true);
    }
  }, [channel?.url, useVLC, engine]);

  /**
   * MOTOR HAFIZASI — OKUMA (v7.3.0)
   * Bu kanal daha önce hangi motorla sorunsuz açıldıysa doğrudan onunla başla.
   * Yalnızca "otomatik" modda geçerli; kullanıcı elle seçtiyse ona saygı duyulur.
   */
  useEffect(() => {
    if (engine !== "auto" || !channel?.id) return;
    let alive = true;
    (async () => {
      try {
        const memo = await storage.getItem<string>(engineMemoKey(String(channel.id)), "");
        if (!alive || !memo) return;
        if (memo === "vlc") setUseVLC(true);
        // "exo" ise zaten varsayılan; bir şey yapmaya gerek yok.
      } catch { /* hafıza okunamazsa normal akış sürer */ }
    })();
    return () => { alive = false; };
  }, [channel?.id, engine]);

  /**
   * MOTOR HAFIZASI — YAZMA (v7.3.0)
   * Yayın gerçekten oynamaya başladıysa (tampon bitti, hata yok) çalışan
   * motoru kaydet. Böylece bir dahaki açılışta deneme-yanılma olmaz.
   */
  useEffect(() => {
    if (engine !== "auto" || !channel?.id) return;
    if (isBuffering || error) return;
    const t = setTimeout(() => {
      storage.setItem(engineMemoKey(String(channel.id)), useVLC ? "vlc" : "exo").catch(() => {});
    }, 2500);   // 2.5 sn sorunsuz oynadıysa "çalışıyor" say
    return () => clearTimeout(t);
  }, [channel?.id, useVLC, isBuffering, error, engine]);
  const supportsCatchup = !isSynthetic && channel?.tv_archive === 1 && activePlaylist?.source === "xtream";

  const player = useVideoPlayer(playUrl ?? null, (p) => {
    p.loop = false;
    /**
     * EXOPLAYER TAMPON AYARI (v7.8.0)
     * SORUN: Tampon ayarı yalnızca VLC'ye uygulanıyordu. ExoPlayer
     * VARSAYILAN 20 SANİYE tamponluyordu -> canlı yayında ciddi gecikme.
     * ÇÖZÜM: Kullanıcının seçtiği değer ExoPlayer'a da uygulanıyor.
     * (Alanlar expo-video paket tipinden doğrulandı.)
     */
    try {
      const sec = Math.max(0.5, bufferMs / 1000);
      p.bufferOptions = {
        preferredForwardBufferDuration: sec,
        minBufferForPlayback: Math.max(0.5, sec / 2),
        maxBufferBytes: 0,
        prioritizeTimeOverSizeThreshold: true,
      };
    } catch { /* eski sürümlerde bu alan olmayabilir */ }
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

  /**
   * HIZLI KONUM TAKİBİ (v5.0.0 — seek bar için)
   * Yukarıdaki 5 saniyelik döngü izleme ilerlemesini KAYDETMEK içindir; zaman
   * çubuğunun akıcı görünmesi için ayrıca 1 saniyelik hafif bir okuma yapıyoruz.
   * (VLC modunda konum zaten onTimeChanged ile geliyor, bu döngü exo içindir.)
   */
  useEffect(() => {
    if (useVLC || !player || !showControls) return;
    const t = setInterval(() => {
      try {
        const cur = (player as any).currentTime;
        const dur = (player as any).duration;
        if (typeof cur === "number") {
          setVideoStats(prev => ({
            ...prev,
            position: Math.floor(cur),
            duration: typeof dur === "number" && dur > 0 ? Math.floor(dur) : prev.duration,
          }));
        }
      } catch {}
    }, 1000);
    return () => clearInterval(t);
  }, [player, useVLC, showControls]);

  /** Belirli bir saniyeye atlar (her iki motorda da çalışır). */
  const seekTo = (seconds: number) => {
    const target = Math.max(0, Math.floor(seconds));
    if (useVLC) {
      if (!isSeekable) { flashMessage("Bu yayında ileri/geri alınamaz"); return; }
      try { vlcRef.current?.seek(target * 1000, "time"); } catch {}
    } else {
      try { (player as any).currentTime = target; } catch {}
    }
    setVideoStats(prev => ({ ...prev, position: target }));
    revealControls();
  };

  /**
   * KANAL / BÖLÜM GEÇİŞİ (zapping)
   * Canlı kanallarda listedeki önceki/sonraki kanala geçer.
   */
  const channelList = useMemo(() => activePlaylist?.channels || [], [activePlaylist]);
  const currentIndex = useMemo(
    () => channelList.findIndex((c: any) => c.id === params.id),
    [channelList, params.id]
  );
  const canZap = !isSynthetic && currentIndex >= 0 && channelList.length > 1;

  const zap = (delta: 1 | -1) => {
    if (!canZap) { flashMessage("Bu içerikte kanal geçişi yok"); return; }
    const next = (currentIndex + delta + channelList.length) % channelList.length;
    const target: any = channelList[next];
    if (!target) return;
    haptic.medium();
    flashMessage(`${delta > 0 ? "⏭" : "⏮"} ${target.name}`);
    router.replace({ pathname: "/player", params: { id: target.id } });
  };

  /** Oynatmayı durdurup geri döner. */
  const stopPlayback = () => {
    haptic.medium();
    try { if (useVLC) vlcRef.current?.stop(); else player?.pause(); } catch {}
    router.back();
  };

  useEffect(() => {
    if (sheet !== "stats") return;
    const t = setInterval(() => setStatsTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sheet]);

  /**
   * TV -> TELEFON SENKRONU (v8.2.0)
   * ===========================================================================
   * SORUN: Telefondan TV'ye komut gidiyordu ama TV'nin DURUMU telefona hiç
   * dönmüyordu. Kullanıcı TV kumandasıyla duraklatınca telefon hâlâ
   * "oynatılıyor" gösteriyordu; ilerleyen konum da telefona yansımıyordu.
   * "Televizyonda kafasına göre gidiyor" şikâyetinin ikinci yarısı buydu.
   *
   * ÇÖZÜM: onMediaStatusUpdated ile TV'nin oynatma durumu ve konumu dinleniyor.
   * (Alanlar paket tipinden doğrulandı: playerState, streamPosition)
   * ===========================================================================
   */
  useEffect(() => {
    if (!castSession) return;
    let sub: any = null;
    try {
      const client = castSession.client || castSession.getClient?.();
      if (!client?.onMediaStatusUpdated) return;

      sub = client.onMediaStatusUpdated((st: any) => {
        if (!st) return;
        // playerState: "playing" | "paused" | "buffering" | "idle" | "loading"
        const ps = String(st.playerState || "").toLowerCase();
        if (ps === "playing") { setIsPlaying(true); setIsBuffering(false); }
        else if (ps === "paused") { setIsPlaying(false); setIsBuffering(false); }
        else if (ps === "buffering" || ps === "loading") { setIsBuffering(true); }

        // Konum (saniye) -> ilerleme çubuğu TV ile aynı yeri göstersin.
        // videoStats.currentTime saniye cinsindendir (yerel oynatıcıyla aynı ölçek).
        if (typeof st.streamPosition === "number" && st.streamPosition >= 0) {
          setVideoStats(prev => ({ ...prev, currentTime: st.streamPosition }));
        }
      });
    } catch { /* dinleyici kurulamazsa tek yönlü çalışmaya devam eder */ }

    return () => { try { sub?.remove?.(); } catch {} };
  }, [castSession]);

  /**
   * KAYIT GÖSTERGESİ (v7.8.0)
   * Kayıt sürerken kırmızı nokta yanıp söner ve süre sayar.
   * Kayıt yokken zamanlayıcı çalışmaz (pil dostu).
   */
  useEffect(() => {
    if (!isRecording) return;
    const t = setInterval(() => {
      setRecBlink(b => !b);
      setStatsTick(Date.now());   // süre sayacı da ilerlesin
    }, 600);
    return () => clearInterval(t);
  }, [isRecording]);


  /**
   * TV KUMANDA — GERİ TUŞU (v5.2.0)
   * TV'de "Geri" iki aşamalı olmalı: kontroller açıksa önce onları kapat,
   * kapalıysa oynatıcıdan çık. Böylece yanlışlıkla yayından düşmek zorlaşır.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showControls) {
        setShowControls(false);
        return true; // olayı tükettik
      }
      return false; // varsayılan davranış: geri git
    });
    return () => sub.remove();
  }, [showControls]);

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
      // v9.5.0: TV/TV Box hiçbir zaman portreye zorlanmaz.
      const exitLock = isTv
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP;
      ScreenOrientation.lockAsync(exitLock).catch(() => {});
    };
  }, [isTv]);

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
        try { vlcRef.current?.pause?.(); } catch {}
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
    // TV'de kumandayla gezmek zaman alır; kontroller daha uzun açık kalsın.
    hideTimer.current = setTimeout(() => setShowControls(false), isTv ? 9000 : 4000);
  };
  useEffect(() => {
    scheduleHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [isTv]);
  const revealControls = () => { setShowControls(true); scheduleHide(); };

  const togglePlay = () => {
    // YAYIN AKTİFSE komutu TV'deki oynatıcıya gönder (v7.4.0).
    if (castSession) {
      try {
        const client = castSession.client || castSession.getClient?.();
        if (client) {
          if (isPlaying) client.pause?.(); else client.play?.();
          setIsPlaying(!isPlaying);
          revealControls();
          return;
        }
      } catch { /* başarısızsa yerel oynatıcıya düş */ }
    }
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
    /**
     * YAYIN SIRASINDA SARMA (v7.4.0, v8.1.0'da iyileştirildi)
     * CANLI yayında sarma yapılamaz (kayıtlı içerik değil) — kullanıcıya
     * sessizce hiçbir şey olmuyormuş gibi görünmesin diye açıkça söylüyoruz.
     */
    if (castSession && !isSynthetic) {
      flashMessage("Canlı yayında ileri/geri alınamaz");
      return;
    }
    if (castSession) {
      try {
        const client = castSession.client || castSession.getClient?.();
        if (client) {
          // Paket tipinden doğrulandı: MediaSeekOptions { position, relative }
          // relative:true -> mevcut konuma GÖRE saniye cinsinden kaydır.
          client.seek?.({ position: delta, relative: true });
          revealControls();
          return;
        }
      } catch { /* başarısızsa yerel oynatıcıya düş */ }
    }
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
    if (useVLC) {
      // VLC: parça id'si ile seçilir (tracks prop'u aşağıda gönderilir).
      if (typeof t?.id === "number") {
        setSelectedAudioTrack(t.id);
        setSelectedAudio(t);
        flashMessage(`Ses: ${t.name || t.label || "Parça"}`);
      }
    } else {
      try { (player as any).audioTrack = t; setSelectedAudio(t); } catch {}
    }
    setSheet(null);
  };

  const selectSubtitle = (t: any) => {
    if (useVLC) {
      // t === null -> altyazıyı kapat (-1)
      const id = t === null ? -1 : (typeof t?.id === "number" ? t.id : undefined);
      if (id !== undefined) {
        setSelectedSubtitleTrack(id);
        setSelectedSubtitle(t);
        flashMessage(t === null ? "Altyazı kapatıldı" : `Altyazı: ${t.name || t.label || "Parça"}`);
      }
    } else {
      try { (player as any).subtitleTrack = t; setSelectedSubtitle(t); } catch {}
    }
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
  /**
   * DOKUNMA = AÇ/KAPAT (v9.3.0 — kullanıcı isteği)
   * Eskiden dokunma yalnızca AÇIYORDU; panel kendiliğinden kaybolana kadar
   * beklemek gerekiyordu. Artık aynı dokunuş kapatıyor da.
   */
  const toggleControls = () => {
    if (showControls) setShowControls(false);
    else revealControls();
  };

  const tapGesture = Gesture.Tap()
    .maxDuration(200)
    .onEnd(() => {
      runOnJS(toggleControls)();
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

  /**
   * DİKEY KAYDIRMA = SES (v7.7.0)
   * Ekranın SAĞ yarısında yukarı/aşağı kaydırma sesi değiştirir.
   * Yukarı = artır, aşağı = azalt. Ekran yüksekliğinin tamamı 0-100 aralığı.
   * TV'de anlamsız olduğu için yalnızca dokunmatik cihazlarda etkin.
   */
  const applyVolume = (v: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    setVolume(clamped);

    /**
     * YAYIN SIRASINDA SES (v8.1.0)
     * Yayın aktifken ses telefonun değil TV'nin sesidir. Kaydırma artık
     * cihazdaki sesi ayarlıyor.
     * NOT: Paket belgesi setStreamVolume için client'ı öneriyor
     * ("session.setVolume promise döndürmez, client.setStreamVolume kullanın").
     * Değer 0-1 aralığındadır, bizim ölçeğimiz 0-100.
     */
    if (castSession) {
      try {
        const client = castSession.client || castSession.getClient?.();
        client?.setStreamVolume?.(clamped / 100);
      } catch { /* başarısızsa yerel ses zaten ayarlandı */ }
    }
    setVolumeHint(clamped);
    if (volHintTimer.current) clearTimeout(volHintTimer.current);
    volHintTimer.current = setTimeout(() => setVolumeHint(null), 900);
  };

  const volumeGesture = Gesture.Pan()
    .enabled(!isTv)
    .activeOffsetY([-12, 12])       // yatay kaydırmayla çakışmasın
    .onBegin(() => { volumeStartRef.current = volume; })
    .onUpdate((e) => {
      // Yalnızca SAĞ yarıda çalışsın (sol yarı ileride parlaklık için ayrılmıştır)
      if (e.x < screenW / 2) return;
      const delta = -(e.translationY / 300) * 100;   // 300px = tam aralık
      runOnJS(applyVolume)(volumeStartRef.current + delta);
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
    try {
      await ScreenOrientation.lockAsync(
        isTv ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
    } catch {}
    router.back();
  };

  const openCatchup = () => {
    if (!channel) return;
    router.replace({ pathname: "/catchup", params: { channel: channel.id } });
  };

  /**
   * TV KUMANDA — MEDYA TUŞLARI (v6.4.0, v7.6.0'da KONUMU DÜZELTİLDİ)
   *
   * ÖNEMLİ DÜZELTME: Bu çağrı eskiden dosyanın ÜST kısmındaydı; oysa
   * kullandığı fonksiyonların bir kısmı (togglePlay, seekBy, openCatchup)
   * DAHA AŞAĞIDA tanımlanıyordu. JavaScript'te `const` yukarı taşınmaz
   * (hoisting yok), bu yüzden bu isimler çağrı anında UNDEFINED oluyordu.
   * Hook içindeki try/catch sayesinde uygulama ÇÖKMÜYOR ama tuşlar
   * SESSİZCE ÇALIŞMIYORDU — CH+/- dahil.
   * Artık tüm bağımlılıklar tanımlandıktan SONRA çağrılıyor.
   */
  /**
   * KAYIT SİSTEMİ (v7.8.0) — KÖK SEBEP DÜZELTİLDİ
   * ===========================================================================
   * NEDEN HİÇ KAYIT OLMUYORDU?
   * expo-file-system'in documentDirectory değeri bir URI'dir:
   *     file:///data/user/0/com.kizilkan.player/files/
   * libVLC ise DÜZ DOSYA YOLU bekler:
   *     /data/user/0/com.kizilkan.player/files/
   * "file://" öneki yüzünden libVLC yolu geçersiz sayıyor ve kayıt hiç
   * başlamıyordu. Hata da onEncounteredError ile geliyor, "yayın hatası"
   * gibi görünüyordu.
   * ÇÖZÜM: Yol libVLC'ye verilmeden önce "file://" öneki temizleniyor.
   * ===========================================================================
   */
  const toNativePath = (uri: string) => uri.replace(/^file:\/\//, "");

  /** Kayıt klasörünü hazırlar ve DÜZ yolu döndürür. */
  const prepareRecordDir = async (target: "app" | "download" | "custom"): Promise<string | null> => {
    try {
      const FS = await import("expo-file-system/legacy");
      let uri: string;

      if (target === "download") {
        // Genel İndirilenler klasörü — dosya yöneticisinden erişilebilir.
        uri = `file:///storage/emulated/0/Download/KIZILKAN Player/Record/`;
      } else if (target === "custom" && customRecordDir) {
        uri = customRecordDir;
      } else {
        // Uygulama klasörü — izin gerektirmez, her zaman çalışır.
        uri = `${FS.documentDirectory}recordings/`;
      }

      try { await FS.makeDirectoryAsync(uri, { intermediates: true }); } catch { /* zaten varsa sorun değil */ }
      return toNativePath(uri);
    } catch (e: any) {
      Alert.alert("Klasör hazırlanamadı", String(e?.message || e));
      return null;
    }
  };

  const startRecording = async (target: "app" | "download" | "custom") => {
    const dir = await prepareRecordDir(target);
    if (!dir) return;
    try {
      await vlcRef.current?.record(dir);
      setIsRecording(true);
      setRecordStart(Date.now());
      setRecordDirLabel(
        target === "download" ? "İndirilenler / KIZILKAN Player / Record" : "Uygulama klasörü"
      );
      setSheet(null);
      flashMessage("● KAYIT BAŞLADI");
    } catch (e: any) {
      setIsRecording(false);
      Alert.alert("Kayıt başlatılamadı", String(e?.message || e));
    }
  };

  const stopRecording = async () => {
    try {
      await vlcRef.current?.record();   // parametresiz = durdur
    } catch { /* yine de durumu temizle */ }
    setIsRecording(false);
    setRecordStart(null);

    /**
     * KAYIT DOĞRULAMASI (v8.3.0) — "kaydetti" deyip dosya olmaması bitti
     * Kullanıcı bildirimi: üç seçenekte de "kaydedildi" yazıyordu ama dosya
     * hiçbir yerde yoktu. Artık dosyanın GERÇEKTEN var olduğu ve boyutu
     * kontrol ediliyor; yoksa sebebi açıkça söyleniyor.
     */
    try {
      const FS: any = await import("expo-file-system/legacy");
      const path = recordPath;
      if (!path) {
        Alert.alert(
          "Kayıt doğrulanamadı",
          "Oynatıcı kayıt dosyasının yerini bildirmedi.\n\n" +
            "Bu genellikle kaydın HİÇ BAŞLAMADIĞI anlamına gelir.\n\n" +
            "Olası sebepler:\n" +
            "• Yayın kopyalamaya kapalı olabilir\n" +
            "• Motor VLC değil (ExoPlayer kayıt yapamaz)\n\n" +
            "Motoru VLC'ye alıp tekrar deneyin."
        );
        return;
      }
      const uri = path.startsWith("file://") ? path : `file://${path}`;
      const info = await FS.getInfoAsync(uri);
      if (info?.exists && (info.size ?? 0) > 0) {
        const mb = ((info.size ?? 0) / 1048576).toFixed(1);
        Alert.alert("Kayıt tamamlandı ✓", `Dosya (${mb} MB):\n${path}`);
      } else {
        Alert.alert(
          "Kayıt dosyası oluşmadı",
          `Beklenen yer:\n${path}\n\n` +
            "Dosya yok veya boş. Yayın kaydedilemiyor olabilir."
        );
      }
    } catch (e: any) {
      Alert.alert("Kayıt durumu bilinmiyor", String(e?.message || e));
    }
  };

  useRemoteKeys({
    channelUp: () => zap(1),
    channelDown: () => zap(-1),
    playPause: togglePlay,
    play: () => { if (!isPlaying) togglePlay(); },
    pause: () => { if (isPlaying) togglePlay(); },
    stop: stopPlayback,
    forward: () => seekBy(30),
    rewind: () => seekBy(-30),
    info: () => setSheet("stats"),
    guide: () => { if (supportsCatchup) openCatchup(); },

    /**
     * SOL/SAĞ İLE KANAL DEĞİŞTİRME (v7.6.0) — TiviMate'in en çok kullanılan
     * kısayolu, bizde eksikti.
     *
     * NEDEN KRİTİK: Chromecast ve Wanbo kumandalarında CH+/- TUŞU YOK.
     * O cihazlarda kanal değiştirmenin BAŞKA YOLU YOKTU.
     *
     * KURAL: Yalnızca kontroller GİZLİYKEN çalışır. Kontroller açıkken
     * sol/sağ normal odak gezinmesi olarak kalır (düğmeler arasında gezinme
     * bozulmasın). Bu, TiviMate'in de uyguladığı davranıştır.
     */
    dpadLeft: () => { if (!showControls) zap(-1); },
    dpadRight: () => { if (!showControls) zap(1); },

    /**
     * YUKARI/AŞAĞI: kontroller gizliyken kanal bilgisini gösterir.
     * (Yayın izlerken "bu ne kanalı" sorusunun hızlı cevabı.)
     */
    dpadUp: () => { if (!showControls) revealControls(); },
    dpadDown: () => { if (!showControls) revealControls(); },

    /**
     * UZUN-BAS GERİ -> KANAL LİSTESİNE DÖN (v7.6.0)
     * TiviMate deseni: her yerden tek hamlede listeye çıkış.
     * Kısa basış normal geri davranışını korur (kontrolleri kapat / çık).
     */
    /**
     * v7.8.0 DÜZELTME: Kullanıcı bildirimi — kısa geri basışı da doğrudan
     * kanal listesine atıyordu. Sebep: native tarafta repeatCount==1 kontrolü
     * bazı kumandalarda KISA basışta da tetikleniyor.
     * ÇÖZÜM: Eşik yükseltildi (aşağıda, plugin içinde) ve burada onay yok;
     * kısa basış BackHandler ile normal davranışını (kontrolleri kapat/çık)
     * sürdürüyor.
     */
    backLongPress: () => {
      haptic.medium();
      router.replace("/(tabs)");
    },
  });


  if (!channel) {
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        <Text style={{ color: "#fff" }}>Kanal bulunamadı</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]} testID="player-screen">
      {/**
        * SİYAH TABAN (v8.9.0) — RENKLİ ŞERİT DÜZELTMESİ
        * Kullanıcı bildirimi: kanal açılırken ekranın üst ~%7'sinde tema
        * renginde bir şerit görünüyor, zap/panel açılınca geçiyordu.
        * SEBEP: video henüz çizilmeden ARKADAKİ katmanın (sekme/stack arka
        * planı, tema renginde) kenardan görünmesi.
        * Stack contentStyle yetmedi; ekranın tamamını kaplayan mutlak siyah
        * bir taban katmanı ekleniyor. Video bunun üstünde çizilir.
        */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} pointerEvents="none" />
      <StatusBar hidden />
      {/* TV KUMANDA (v5.2.0): video alanı odaklanabilir. Kumandada OK'a basınca
          kontroller açılır; D-pad ile alttaki transport düğmeleri gezilir.
          Bu, react-native-tvos fork'una gerek kalmadan çalışan standart yoldur. */}
      {/**
        * v8.9.0 REGRESYON GERİ ALMA — KRİTİK
        * v8.8.0'da bu katmanı "her zaman render" yaptım. Katman tüm ekranı
        * kaplıyor ve hasTVPreferredFocus taşıyor; kontroller AÇIKKEN de var
        * olunca ODAĞI SÜREKLİ KENDİNE ÇEKİYORDU. Kullanıcı D-pad ile
        * düğmelere gidemiyor, tuşlar "çok geç tepki veriyor" gibi
        * hissettiriyordu.
        * GERİ ALINDI: yalnızca kontroller kapalıyken var.
        * Panelin OK ile kapanması, panelin KENDİ üzerindeki kapatma
        * davranışıyla sağlanıyor (aşağıda).
        */}
      {isTv && !showControls && (
        <FocusButton
          testID="tv-focus-catcher"
          focusable
          hasTVPreferredFocus
          activeOpacity={1}
          /**
           * OK TUŞU = AÇ/KAPAT (v8.6.0)
           * Eskiden yalnızca AÇIYORDU (revealControls). Kullanıcı paneli
           * kapatamıyordu; kendi kendine kaybolmasını beklemek gerekiyordu.
           * Artık aynı tuş kapatıyor da.
           */
          onPress={() => {
            if (showControls) setShowControls(false);
            else revealControls();
          }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <GestureDetector gesture={Gesture.Exclusive(doubleTapGesture, longPressGesture, volumeGesture, tapGesture)}>
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
              uri={playUrl || channel.url}
              bufferMs={bufferMs}
              volume={volume}
              /**
               * GERÇEK KAYIT YOLU (v7.8.0)
               * Paket kaydın gerçek dosya yolunu bu olayla bildiriyor
               * ({ path, isRecording }). Böylece kullanıcıya tam yeri
               * söyleyebiliyoruz — "bir yere kaydedildi" demek yerine.
               */
              onRecordChanged={(e: any) => {
                if (e?.path) setRecordPath(String(e.path));
                if (typeof e?.isRecording === "boolean") setIsRecording(e.isRecording);
              }}
              hardwareAccel={hwAccel}
              audioDelayMs={audioDelay}
              /* KANAL BAŞINA UA (v7.3.0): kullanıcı bu kanal için özel bir
                 User-Agent tanımladıysa onu kullan, yoksa varsayılan. */
              userAgent={(overrides?.[channel?.id || ""]?.userAgent) || DEFAULT_USER_AGENT}
              tracks={
                vlcVideoTrackId !== undefined &&
                (selectedAudioTrack !== undefined || selectedSubtitleTrack !== undefined)
                  ? {
                      audio: selectedAudioTrack ?? (audioTracks[0]?.id ?? -1),
                      video: vlcVideoTrackId,
                      subtitle: selectedSubtitleTrack ?? -1,
                    }
                  : undefined
              }
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
                if (Array.isArray(t.audio)) setAudioTracks(t.audio);
                if (Array.isArray(t.subtitle)) setSubtitleTracks(t.subtitle);
                // Video parçası id'si: seçim yaparken bunu da göndermek ZORUNLU.
                if (Array.isArray(t.video) && t.video.length > 0) {
                  setVlcVideoTrackId(t.video[0]?.id);
                }
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
          <FocusButton
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
          </FocusButton>

          {/* SORUN KİMDE? (v5.4.0)
              Kullanıcı "uygulama mı, sağlayıcı mı" diye tahmin etmek zorunda
              kalmasın: yayın adresine doğrudan istek atıp sunucunun ne dediğini
              raporluyoruz. */}
          <FocusButton
            testID="player-test-stream-btn"
            focusable
            disabled={testing}
            onPress={async () => {
              if (!channel?.url) return;
              setTesting(true);
              try {
                const r = await testStream(channel.url, DEFAULT_USER_AGENT);
                Alert.alert(
                  r.title,
                  r.detail +
                    `\n\nSorumlu taraf: ${
                      r.blame === "sunucu" ? "SAĞLAYICI (sunucu)"
                        : r.blame === "oynatici" ? "OYNATICI (uygulama ayarları)"
                        : r.blame === "ag" ? "AĞ / İNTERNET"
                        : "belirsiz"
                    }`
                );
              } finally {
                setTesting(false);
              }
            }}
            style={[styles.retryBtn, {
              backgroundColor: "transparent",
              borderWidth: 1,
              borderColor: colors.border,
              marginTop: SPACING.sm,
              opacity: testing ? 0.5 : 1,
            }]}
          >
            <Text style={[styles.retryText, { color: colors.onSurface }]}>
              {testing ? "Test ediliyor..." : "Kanalı Test Et (sorun kimde?)"}
            </Text>
          </FocusButton>
        </View>
      )}

      {showControls && (
        <>
          <View
            style={[
              styles.topBar,
              {
                // Çentik/durum çubuğu ile çakışmayı önle (yatay modda sol/sağ da).
                paddingTop: Math.max(insets.top, SPACING.md),
                paddingLeft: SPACING.lg + insets.left,
                paddingRight: SPACING.lg + insets.right,
              },
            ]}
            pointerEvents="box-none"
          >
            <FocusButton testID="player-back-btn" onPress={goBack} style={styles.iconBtn} hitSlop={12}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </FocusButton>
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
                onConnectionChange={(conn, session) => {
                  /**
                   * YEREL OYNATICIYI DURDUR (v8.2.0) — KRİTİK
                   * SORUN: Yayın başlayınca telefondaki oynatıcı ÇALIŞMAYA DEVAM
                   * ediyordu. İki bağımsız oynatma birden sürüyor, hiçbir
                   * senkron olmuyordu ("TV kafasına göre gidiyor").
                   * ÇÖZÜM: Yayın açılınca yerel oynatma duraklatılır; yayın
                   * kapanınca kaldığı yerden devam eder.
                   */
                  setCastSession(conn ? session : null);
                  try {
                    if (conn) {
                      if (useVLC) vlcRef.current?.pause();
                      else player?.pause();
                      setIsPlaying(false);
                    } else {
                      if (useVLC) vlcRef.current?.play();
                      else player?.play();
                      setIsPlaying(true);
                    }
                  } catch { /* oynatıcı hazır değilse sorun değil */ }
                }}
                source={{
                  url: channel.url,
                  name: channel.name,
                  poster: (channel as any).logo,
                  /**
                   * CANLI/KAYITLI AYRIMI (v8.1.0)
                   * isSynthetic = film/dizi (kayıtlı), değilse canlı yayın.
                   * Chromecast bu bilgi olmadan canlı akışı oynatamıyordu.
                   */
                  isLive: !isSynthetic,
                  // Film/dizide telefondaki konumdan devam (v8.2.0)
                  startTimeSec: isSynthetic ? (videoStats.currentTime || 0) : undefined,
                  /**
                   * CHROMECAST FORMAT DÜZELTMESİ (v7.4.0)
                   * ESKİ MANTIK TERSTİ: container_ext varsa (yani .ts canlı
                   * kanallar) contentType undefined gönderiliyordu; CastButton
                   * da adresi .m3u8'e çevirdikten sonra MIME'ı "video/mp4"
                   * tahmin ediyordu. Chromecast HLS akışını mp4 sanıp
                   * REDDEDİYORDU -> "Medya seçilmedi".
                   * ARTIK: contentType'ı hiç göndermiyoruz; CastButton
                   * ÇEVRİLMİŞ adrese göre doğru MIME'ı kendisi belirliyor
                   * (.m3u8 -> application/x-mpegURL).
                   */
                }}
                size={22}
                color="#fff"
              />
            </View>
            <FocusButton
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
            </FocusButton>
            {!isSynthetic && (
              <FocusButton
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
              </FocusButton>
            )}
          </View>

          <View style={styles.centerCtrl} pointerEvents="box-none">
            <FocusButton testID="player-seek-back-btn" onPress={() => seekBy(-10)} style={styles.seekBtn}>
              <Ionicons name="play-back" size={26} color="#fff" />
              <Text style={styles.seekLabel}>10s</Text>
            </FocusButton>
            <FocusButton testID="player-playpause-btn" onPress={togglePlay} style={styles.playBtn} activeOpacity={0.7}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={38} color="#fff" />
            </FocusButton>
            <FocusButton testID="player-seek-fwd-btn" onPress={() => seekBy(10)} style={styles.seekBtn}>
              <Ionicons name="play-forward" size={26} color="#fff" />
              <Text style={styles.seekLabel}>10s</Text>
            </FocusButton>
          </View>

          <View
            style={[
              styles.bottomBar,
              {
                // ANDROID GEZİNME ÇUBUĞU ÇAKIŞMASI DÜZELTMESİ (v4.9.1):
                // Kontroller ekranın en altına sabitleniyordu; telefonun geri/
                // ana sayfa tuşlarıyla üst üste biniyordu. Güvenli alan kadar
                // boşluk bırakıyoruz (yatay modda çentik için sol/sağ da).
                paddingBottom: Math.max(insets.bottom, SPACING.sm),
                paddingLeft: insets.left,
                paddingRight: insets.right,
              },
            ]}
            pointerEvents="box-none"
          >
            {/* ZAMAN ÇUBUĞU (v5.0.0) — filmde istediğin dakikaya atla */}
            <SeekBar
              position={videoStats.position || 0}
              duration={videoStats.duration || 0}
              isLive={!isSynthetic}
              onSeek={seekTo}
            />

            {/* TRANSPORT KONTROLLERİ (v5.0.0) — IPTV Extreme'deki gibi */}
            <View style={styles.transportRow}>
              <FocusButton testID="player-prev-btn" onPress={() => zap(-1)} hitSlop={8} focusable style={styles.transportBtn}>
                <Ionicons name="play-skip-back" size={26} color={canZap ? "#fff" : "rgba(255,255,255,0.3)"} />
              </FocusButton>
              <FocusButton testID="player-rew-btn" onPress={() => seekBy(-10)} hitSlop={8} focusable style={styles.transportBtn}>
                <Ionicons name="play-back" size={26} color="#fff" />
              </FocusButton>
              <FocusButton testID="player-toggle-btn" onPress={togglePlay} hitSlop={8} focusable style={styles.transportBtn}>
                <Ionicons name={isPlaying ? "pause" : "play"} size={34} color="#fff" />
              </FocusButton>
              <FocusButton testID="player-stop-btn" onPress={stopPlayback} hitSlop={8} focusable style={styles.transportBtn}>
                <Ionicons name="stop" size={26} color="#fff" />
              </FocusButton>
              <FocusButton testID="player-ff-btn" onPress={() => seekBy(10)} hitSlop={8} focusable style={styles.transportBtn}>
                <Ionicons name="play-forward" size={26} color="#fff" />
              </FocusButton>
              <FocusButton testID="player-next-btn" onPress={() => zap(1)} hitSlop={8} focusable style={styles.transportBtn}>
                <Ionicons name="play-skip-forward" size={26} color={canZap ? "#fff" : "rgba(255,255,255,0.3)"} />
              </FocusButton>
            </View>
            {/* ORTA IZGARA MENÜ (v5.6.0 — IPTV Extreme Pro yerleşimi)
                ESKİ: 12 seçenek yatay şeritte sıralıydı; sağdakiler ekran
                dışında kalıyor, kullanıcı bulamıyordu.
                YENİ: ekranın ORTASINDA ızgara — hepsi tek bakışta görünür,
                TV'de kumandayla yukarı/aşağı/sağa/sola gezilebilir. */}
          </View>
            <View style={styles.gridWrap} pointerEvents="box-none">
              <View style={[styles.grid, { backgroundColor: "rgba(0,0,0,0.72)", borderColor: colors.border }]}>
                <GridBtn testID="player-engine-btn" icon="hardware-chip" label={useVLC ? "VLC" : "Exo"} onPress={() => setSheet("engine")} />
                <GridBtn testID="player-audio-btn" icon="musical-notes" label={audioTracks.length > 0 ? `Ses (${audioTracks.length})` : "Ses"} onPress={() => setSheet("audio")} />
                <GridBtn testID="player-subtitle-btn" icon="text" label={subtitleTracks.length > 0 ? `Altyazı (${subtitleTracks.length})` : "Altyazı"} onPress={() => setSheet("subtitle")} />
                <GridBtn testID="player-fit-btn" icon="resize" label={fit === "contain" ? "Sığdır" : fit === "cover" ? "Doldur" : "Uzat"} onPress={cycleFit} />
                <GridBtn testID="player-speed-btn" icon="speedometer" label={`${speed.toFixed(2)}x`} onPress={() => setSheet("speed")} highlighted={speed !== 1.0} />

                <GridBtn testID="player-audiodelay-btn" icon="git-compare" label="Senkron" onPress={() => setSheet("audiodelay")} />
                {(isSynthetic || isSeekable) && (
                  <GridBtn testID="player-jump-btn" icon="timer" label="Süreye Git" onPress={() => { setJumpText(""); setSheet("jump"); }} />
                )}
                <GridBtn testID="player-buffer-btn" icon="cellular" label="Tampon" onPress={() => setSheet("buffer")} />
                <GridBtn testID="player-sleep-btn" icon="moon" label={sleepAt ? "Uyku Açık" : "Uyku"} onPress={() => setSheet("sleep")} highlighted={!!sleepAt} />
                <GridBtn testID="player-stats-btn" icon="analytics" label="Bilgi" onPress={() => setSheet("stats")} />
                {supportsCatchup && (
                  <GridBtn testID="player-catchup-btn" icon="play-back-circle" label="Catch-up" onPress={openCatchup} />
                )}
                {/* DVR KAYDI (v7.3.0) — altyapı hazırdı, arayüzü yoktu.
                    Yalnızca VLC motorunda çalışır (ExoPlayer kayıt desteklemez). */}
                {/**
                  * v8.8.0: Kayıt düğmesi ARTIK HER ZAMAN GÖRÜNÜR.
                  * Eskiden yalnızca VLC motorundayken gösteriliyordu; kullanıcı
                  * ExoPlayer'dayken düğmeyi bulamıyor, "kayboldu" sanıyordu.
                  * Artık görünür; ExoPlayer'daysa sebebi açıklanıp VLC'ye
                  * geçmesi öneriliyor.
                  */}
                <GridBtn
                  testID="player-record-btn"
                  icon={isRecording ? "stop-circle" : "radio-button-on"}
                  label={isRecording ? "Kaydı Bitir" : "Kaydet"}
                  highlighted={isRecording}
                  onPress={() => {
                    if (!useVLC) {
                      Alert.alert(
                        "Kayıt için VLC gerekiyor",
                        "Şu an ExoPlayer motoru kullanılıyor ve bu motor kayıt yapamaz.\n\n" +
                          "Izgaradaki ilk düğmeden motoru VLC'ye alıp tekrar deneyin."
                      );
                      return;
                    }
                    if (isRecording) { stopRecording(); } else { setSheet("recordTarget"); }
                  }}
                />

                {/* EKRAN GÖRÜNTÜSÜ (v7.3.0) */}
                {useVLC && (
                  <GridBtn
                    testID="player-snapshot-btn"
                    icon="camera"
                    label="Görüntü Al"
                    onPress={() => {
                      try {
                        const name = `kizilkan-${Date.now()}.png`;
                        vlcRef.current?.snapshot(name);
                        Alert.alert("Ekran görüntüsü alındı", name);
                      } catch (e: any) {
                        Alert.alert("Görüntü alınamadı", String(e?.message || e));
                      }
                    }}
                  />
                )}

                <GridBtn testID="player-reload-btn" icon="refresh" label="Yenile" onPress={() => {
                  setIsBuffering(true);
                  if (useVLC) { try { vlcRef.current?.stop(); } catch {} setTimeout(() => { try { vlcRef.current?.play(); } catch {} }, 250); }
                  else { try { (player as any)?.replay?.(); } catch {} }
                }} />
              </View>
            </View>
        </>
      )}

      {/* KAYIT GÖSTERGESİ (v7.8.0) — sağ üstte yanıp sönen kırmızı nokta.
          Kontroller gizliyken de görünür; kullanıcı kayıtta olduğunu bilir. */}
      {isRecording && (
        <View style={styles.recBadge} pointerEvents="none">
          <View style={[styles.recDot, { opacity: recBlink ? 1 : 0.15 }]} />
          <Text style={styles.recText}>
            REC {recordStart ? fmtDur(Math.floor((statsTick - recordStart) / 1000)) : ""}
          </Text>
        </View>
      )}

      {/* SES GÖSTERGESİ (v7.7.0) — kaydırırken anlık seviye */}
      {volumeHint !== null && (
        <View style={styles.volumeHint} pointerEvents="none">
          <Ionicons
            name={volumeHint === 0 ? "volume-mute" : volumeHint < 40 ? "volume-low" : "volume-high"}
            size={30}
            color="#fff"
          />
          <View style={styles.volumeBarBg}>
            <View style={[styles.volumeBarFill, { width: `${volumeHint}%`, backgroundColor: colors.brandPrimary }]} />
          </View>
          <Text style={styles.volumeText}>{volumeHint}</Text>
        </View>
      )}

      {!error && (
        <View style={styles.spinnerOverlay} pointerEvents="none">
          {isBuffering && <ActivityIndicator size="large" color={colors.brandPrimary} />}
        </View>
      )}

      {/* Bottom Sheet */}
      <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        {/* KLAVYE DÜZELTMESİ (v5.5.0): Dikey modda telefon klavyesi açılınca
            "Süreye Git" giriş kutusu klavyenin altında kalıyordu. Panel artık
            klavyenin üstüne kayıyor. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheet(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.onSurfaceTertiary }]} />
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>
              {sheet === "sleep" ? "Uyku Zamanlayıcısı"
                : sheet === "audio" ? "Ses Parçası"
                : sheet === "speed" ? "Oynatma Hızı"
                : sheet === "stats" ? "Yayın Bilgisi"
                : sheet === "buffer" ? "Ağ Tamponu (takılma)"
                : sheet === "engine" ? "Oynatıcı Motoru"
                : sheet === "audiodelay" ? "Ses Senkronu (A/V)"
                : sheet === "jump" ? "Süreye Git / Atla"
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
              {sheet === "engine" && (
                <>
                  <SheetItem
                    testID="engine-auto-btn"
                    label="Otomatik (önerilen)"
                    icon="flash"
                    onPress={async () => { setEngine("auto"); await storage.setItem(ENGINE_KEY, "auto"); setSheet(null); flashMessage("Motor: Otomatik — kanalı yeniden açın"); }}
                    active={engine === "auto"}
                  />
                  <SheetItem
                    testID="engine-vlc-btn"
                    label="VLC (en uyumlu — her codec)"
                    icon="shield-checkmark"
                    onPress={async () => { setEngine("vlc"); await storage.setItem(ENGINE_KEY, "vlc"); setUseVLC(true); setSheet(null); flashMessage("Motor: VLC"); }}
                    active={engine === "vlc"}
                  />
                  <SheetItem
                    testID="engine-exo-btn"
                    label="ExoPlayer (hızlı — az pil)"
                    icon="speedometer"
                    onPress={async () => { setEngine("exo"); await storage.setItem(ENGINE_KEY, "exo"); setUseVLC(false); setSheet(null); flashMessage("Motor: ExoPlayer — kanalı yeniden açın"); }}
                    active={engine === "exo"}
                  />
                  <SheetItem
                    testID="engine-hw-btn"
                    label={hwAccel ? "Donanım hızlandırma: AÇIK" : "Donanım hızlandırma: KAPALI (yazılım)"}
                    icon="hardware-chip"
                    onPress={async () => {
                      const next = !hwAccel;
                      setHwAccel(next);
                      await storage.setItem(HWACCEL_KEY, next);
                      setSheet(null);
                      flashMessage(next ? "Donanım hızlandırma açıldı" : "Yazılım çözücüye geçildi");
                    }}
                    active={hwAccel}
                  />
                </>
              )}
              {sheet === "jump" && (
                <View style={{ gap: SPACING.md }}>
                  {/* Mevcut konum / süre bilgisi */}
                  <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm, textAlign: "center" }}>
                    Şu an: {fmtDur(videoStats.position || 0)}
                    {videoStats.duration ? `  /  Toplam: ${fmtDur(videoStats.duration)}` : ""}
                  </Text>

                  {/* Tam zaman girişi */}
                  <View style={{ flexDirection: "row", gap: SPACING.sm, alignItems: "center" }}>
                    <TextInput
                      testID="jump-time-input"
                      value={jumpText}
                      onChangeText={(t) => setJumpText(t.replace(/[^0-9:]/g, ""))}
                      placeholder="1:23:45  veya  23:45"
                      placeholderTextColor={colors.onSurfaceTertiary}
                      keyboardType="numbers-and-punctuation"
                      style={{
                        flex: 1, height: 50, borderRadius: RADIUS.md, borderWidth: 1,
                        borderColor: colors.border, backgroundColor: colors.surface,
                        color: colors.onSurface, paddingHorizontal: SPACING.md,
                        fontSize: FONT.size.lg, textAlign: "center",
                      }}
                    />
                    <FocusButton
                      testID="jump-go-btn"
                      focusable
                      onPress={() => {
                        const sec = parseTimeInput(jumpText);
                        if (sec === null) { flashMessage("Geçersiz süre"); return; }
                        const max = videoStats.duration || 0;
                        if (max > 0 && sec > max) { flashMessage("Süre videodan uzun"); return; }
                        seekTo(sec);
                        flashMessage(`⏱ ${fmtDur(sec)}`);
                        setSheet(null);
                      }}
                      style={{
                        height: 50, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md,
                        backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: colors.onBrandPrimary, fontWeight: FONT.weight.bold }}>Git</Text>
                    </FocusButton>
                  </View>

                  {/* Hızlı atlama */}
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 1 }}>
                    HIZLI ATLA
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
                    {JUMP_STEPS.map(step => (
                      <FocusButton
                        key={step}
                        testID={`jump-step-${step}`}
                        focusable
                        onPress={() => {
                          seekBy(step);
                          flashMessage(`${step > 0 ? "⏭ +" : "⏮ "}${Math.abs(step) >= 60 ? `${Math.abs(step) / 60} dk` : `${Math.abs(step)} sn`}`);
                        }}
                        style={{
                          paddingHorizontal: SPACING.md, paddingVertical: 12,
                          borderRadius: RADIUS.pill, borderWidth: 1, borderColor: colors.border,
                          backgroundColor: colors.surfaceTertiary,
                        }}
                      >
                        <Text style={{ color: colors.onSurface, fontWeight: FONT.weight.semibold }}>
                          {step > 0 ? "+" : "−"}{Math.abs(step) / 60} dk
                        </Text>
                      </FocusButton>
                    ))}
                  </View>

                  {/* Yüzdeye atla (süre biliniyorsa) */}
                  {(videoStats.duration || 0) > 0 && (
                    <>
                      <Text style={{ color: colors.onSurfaceTertiary, fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 1 }}>
                        FİLMİN NERESİ
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
                        {JUMP_PERCENTS.map(pct => (
                          <FocusButton
                            key={pct}
                            testID={`jump-pct-${pct}`}
                            focusable
                            onPress={() => {
                              const target = Math.floor(((videoStats.duration || 0) * pct) / 100);
                              seekTo(target);
                              flashMessage(`⏱ %${pct} — ${fmtDur(target)}`);
                              setSheet(null);
                            }}
                            style={{
                              paddingHorizontal: SPACING.md, paddingVertical: 12,
                              borderRadius: RADIUS.pill, borderWidth: 1, borderColor: colors.border,
                              backgroundColor: colors.surfaceTertiary,
                            }}
                          >
                            <Text style={{ color: colors.onSurface, fontWeight: FONT.weight.semibold }}>%{pct}</Text>
                          </FocusButton>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              )}
              {sheet === "audiodelay" && AUDIO_DELAY_OPTIONS.map(ms => (
                <SheetItem
                  key={ms}
                  testID={`audiodelay-${ms}-btn`}
                  label={
                    ms === 0 ? "Normal (senkron)"
                      : ms < 0 ? `Ses ${Math.abs(ms)} ms ERKEN`
                      : `Ses ${ms} ms GEÇ`
                  }
                  icon="git-compare"
                  onPress={async () => {
                    setAudioDelay(ms);
                    await storage.setItem(AUDIO_DELAY_KEY, ms);
                    setSheet(null);
                    flashMessage("Senkron değişti — kanalı yeniden açın");
                  }}
                  active={audioDelay === ms}
                />
              ))}
              {/* KAYIT HEDEFİ SEÇİMİ (v7.8.0 — kullanıcı isteği) */}
              {sheet === "recordTarget" && (
                <>
                  <SheetItem
                    testID="rec-target-app"
                    icon="phone-portrait"
                    label="Uygulama klasörü (izin gerekmez)"
                    onPress={() => startRecording("app")}
                  />
                  <SheetItem
                    testID="rec-target-download"
                    icon="download"
                    label="İndirilenler / KIZILKAN Player / Record"
                    onPress={() => startRecording("download")}
                  />
                  <SheetItem
                    testID="rec-target-custom"
                    icon="folder-open"
                    label={customRecordDir ? "Seçtiğim klasör" : "Klasör seç…"}
                    onPress={async () => {
                      try {
                        const FS: any = await import("expo-file-system/legacy");
                        const perm = await FS.StorageAccessFramework?.requestDirectoryPermissionsAsync?.();
                        if (perm?.granted && perm.directoryUri) {
                          setCustomRecordDir(perm.directoryUri);
                          await startRecording("custom");
                        } else {
                          Alert.alert("Klasör seçilmedi", "Kayıt için bir klasör seçmelisiniz.");
                        }
                      } catch (e: any) {
                        Alert.alert(
                          "Klasör seçilemedi",
                          "Bu cihazda klasör seçimi desteklenmiyor olabilir.\n\n" +
                            "Diğer iki seçenekten birini kullanabilirsiniz."
                        );
                      }
                    }}
                  />
                </>
              )}

              {sheet === "buffer" && BUFFER_OPTIONS.map(ms => (
                <SheetItem
                  key={ms}
                  testID={`buffer-${ms}-btn`}
                  label={
                    ms === 0
                      ? "En düşük — feed/canlı için (takılma riski)"
                      : ms === 300
                      ? "0.3 saniye — çok düşük gecikme"
                      : `${(ms / 1000).toFixed(ms % 1000 ? 1 : 0)} saniye${
                          ms === 1500 ? " (varsayılan)" : ms >= 4000 ? " — zayıf bağlantı" : ""
                        }`
                  }
                  icon="cellular"
                  onPress={async () => {
                    setBufferMs(ms);
                    await storage.setItem(BUFFER_KEY, ms);
                    setSheet(null);
                    flashMessage("Tampon değişti — kanalı yeniden açın");
                  }}
                  active={bufferMs === ms}
                />
              ))}
              {sheet === "stats" && (
                <View style={styles.statsCard}>
                  {/* CANLI GÖSTERGE (v7.5.0): panel açıkken saniyede bir
                      yenilenir; konum/tampon/geçen süre anlık görünür. */}
                  <StatsRow
                    label="Durum"
                    value={
                      isBuffering ? "Tamponlanıyor…"
                      : isPlaying ? "Oynatılıyor"
                      : "Duraklatıldı"
                    }
                  />
                  <StatsRow label="Motor" value={useVLC ? "VLC (libVLC)" : "ExoPlayer"} />
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
                  {isRecording && recordStart ? (
                    <StatsRow
                      label="Kayıt süresi"
                      value={fmtDur(Math.floor((statsTick - recordStart) / 1000))}
                    />
                  ) : null}
                  <StatsRow label="URL" value={channel.url?.slice(0, 60) + "..."} mono />
                  {/*
                    DÜRÜST NOT (v7.5.0): Bit hızı (bitrate) ve FPS burada
                    gösterilmiyor çünkü kullandığımız oynatıcı kütüphanesi bu
                    değerleri uygulamaya BİLDİRMİYOR. Uydurma sayı göstermek
                    yerine, sağladığı gerçek bilgileri gösteriyoruz.
                  */}
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: FONT.size.xs, marginTop: SPACING.sm, lineHeight: 16 }}>
                    Bit hızı ve FPS, kullanılan oynatıcı kütüphanesi tarafından
                    bildirilmediği için gösterilemiyor. Çözünürlük, format ve
                    durum bilgileri gerçek zamanlıdır.
                  </Text>
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
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/**
 * Orta ızgara düğmesi (v5.6.0 — IPTV Extreme Pro tarzı).
 * Büyük ikon + altında etiket. TV'de odaklanınca belirginleşir.
 */
function GridBtn({
  testID, icon, label, onPress, highlighted,
}: {
  testID: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  highlighted?: boolean;
}) {
  const { colors } = useTheme();
  const { isFocused, onFocus, onBlur } = useTVFocus();
  const tint = highlighted ? colors.brandPrimary : "#fff";
  return (
    <FocusButton
      testID={testID}
      onPress={onPress}
      activeOpacity={0.75}
      focusable
      onFocus={onFocus}
      onBlur={onBlur}
      style={[
        gridStyles.item,
        isFocused && {
          borderColor: colors.brandPrimary,
          backgroundColor: colors.brandPrimary + "22",
          transform: [{ scale: 1.08 }],
        },
      ]}
    >
      <Ionicons name={icon} size={26} color={tint} />
      <Text style={[gridStyles.label, { color: tint }]} numberOfLines={1}>{label}</Text>
    </FocusButton>
  );
}

const gridStyles = StyleSheet.create({
  item: {
    width: 78, height: 66, borderRadius: 12, borderWidth: 1, borderColor: "transparent",
    alignItems: "center", justifyContent: "center", gap: 4,
  },
  label: { fontSize: 10, fontWeight: "600" },
});

function ActionBtn({ testID, icon, label, onPress, highlighted }: { testID: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; highlighted?: boolean }) {
  return (
    <FocusButton testID={testID} onPress={onPress} focusable style={styles.actionBtn}>
      <Ionicons name={icon} size={20} color={highlighted ? "#FFCA28" : "#fff"} />
      <Text style={[styles.actionText, highlighted && { color: "#FFCA28" }]}>{label}</Text>
    </FocusButton>
  );
}

function SheetItem({ testID, label, icon, onPress, active, danger }: { testID: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; active?: boolean; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <FocusButton testID={testID} onPress={onPress} activeOpacity={0.7} focusable
      style={[styles.sheetItem, { borderColor: colors.border }, active && { backgroundColor: colors.surfaceSecondary }]}>
      <Ionicons name={icon} size={20} color={danger ? colors.error : active ? colors.brandPrimary : colors.onSurface} />
      <Text style={[styles.sheetItemText, { color: danger ? colors.error : active ? colors.brandPrimary : colors.onSurface }]}>{label}</Text>
      {active && <Ionicons name="checkmark" size={20} color={colors.brandPrimary} />}
    </FocusButton>
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
  transportRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-evenly",
    paddingVertical: SPACING.xs, paddingHorizontal: SPACING.lg,
  },
  transportBtn: { padding: SPACING.sm },
  /**
   * ORTA IZGARA KONUMU (v5.7.0 düzeltmesi)
   * ESKİ: tam ekran ortasına hizalanıyordu; zaman çubuğu ve transport
   *       düğmeleriyle ÜST ÜSTE biniyordu (ekran görüntüsündeki sorun).
   * YENİ: IPTV Extreme Pro'daki gibi ÜST-ORTA bölgede duruyor; alt kontroller
   *       serbest kalıyor. Yükseklik ekranın %55'i ile sınırlı.
   */
  recBadge: {
    position: "absolute", top: 16, right: 16, flexDirection: "row", alignItems: "center",
    gap: 8, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, zIndex: 95,
  },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#FF2D2D" },
  recText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  volumeHint: {
    position: "absolute", alignSelf: "center", top: "40%",
    backgroundColor: "rgba(0,0,0,0.82)", paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 16, alignItems: "center", gap: 10, minWidth: 180, zIndex: 90,
  },
  volumeBarBg: { width: 140, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  volumeBarFill: { height: "100%", borderRadius: 3 },
  volumeText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  gridWrap: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: "55%",
    alignItems: "center", justifyContent: "center",
  },
  grid: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center",
    gap: 6, padding: SPACING.md, borderRadius: 16, borderWidth: 1,
    maxWidth: 430,
  },
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
