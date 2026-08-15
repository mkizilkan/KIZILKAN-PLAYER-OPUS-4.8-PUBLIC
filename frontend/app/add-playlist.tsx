import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "@/src/theme/ThemeContext";
import { SPACING, RADIUS, FONT } from "@/src/theme/themes";
import { usePlaylists } from "@/src/store/PlaylistContext";
import { api } from "@/src/utils/api";
import {
  fetchAndParseM3U, parseM3U,
  xtreamLogin as xtLoginLocal,
  xtreamLiveStreams, xtreamVod as xtVodLocal, xtreamSeries as xtSeriesLocal,
  detectXtreamFromM3U,
} from "@/src/utils/iptv";
import type { Playlist, AccountInfo } from "@/src/types";
import { FocusButton } from "@/src/components/FocusButton";
// v10.4.0: akıllı yapıştırma (panodaki tam adresten bilgileri ayıklamak için)
import * as Clipboard from "expo-clipboard";
import {
  resolveServerCode, DEFAULT_CODE_SOURCE, CODE_SOURCE_KEY,
  // v10.4.0: panel rehberi, otomatik bulma, akıllı yapıştırma
  listPanels, findPanelByCredentials, parseXtreamUrl, describeAccount,
  type PanelEntry, type FindPanelMatch,
} from "@/src/utils/serverCode";
import { storage } from "@/src/utils/storage";

type Method = "m3u_url" | "m3u_file" | "xtream" | "stalker" | "code";

export default function AddPlaylist() {
  /**
   * ALAN ARASI GEÇİŞ (v9.3.0 — kullanıcı isteği)
   * Telefon/tablette klavyedeki "İleri" tuşu, TV'de kumanda OK tuşu bir
   * sonraki alana geçirir. Eskiden her alanı elle seçmek gerekiyordu.
   */
  const refXtUser = React.useRef<any>(null);
  const refXtPass = React.useRef<any>(null);
  const refStMac = React.useRef<any>(null);
  const refStSerial = React.useRef<any>(null);
  const refM3uUrl = React.useRef<any>(null);
  const refXtServer = React.useRef<any>(null);
  const refStPortal = React.useRef<any>(null);

  const router = useRouter();
  const { colors } = useTheme();
  const { addPlaylist } = usePlaylists();

  const [method, setMethod] = useState<Method>("m3u_url");
  const [name, setName] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const [xtServer, setXtServer] = useState("");
  const [xtUser, setXtUser] = useState("");
  const [xtPass, setXtPass] = useState("");
  const [stPortal, setStPortal] = useState("");
  const [stMac, setStMac] = useState("");
  const [stSerial, setStSerial] = useState("");
  // v9.13.0: Sunucu Kodu ile giriş
  const [codeVal, setCodeVal] = useState("");
  const [codeSource, setCodeSource] = useState(DEFAULT_CODE_SOURCE);
  const [showCodeSource, setShowCodeSource] = useState(false);
  /* ---- v10.4.0: PANEL REHBERİ ---- */
  const [panelListOpen, setPanelListOpen] = useState(false);
  const [panels, setPanels] = useState<PanelEntry[]>([]);
  const [panelsLoading, setPanelsLoading] = useState(false);
  const [panelSearch, setPanelSearch] = useState("");
  /* ---- v10.4.0: OTOMATİK PANEL BULMA ---- */
  const [findOpen, setFindOpen] = useState(false);          // onay ekranı
  const [finding, setFinding] = useState(false);            // arama sürüyor
  const [findMsg, setFindMsg] = useState("");               // "38/40 panel denendi…"
  const [findOffset, setFindOffset] = useState(0);          // devam için imleç
  const [findTotal, setFindTotal] = useState(0);            // rehberdeki toplam
  const [findExhausted, setFindExhausted] = useState(false);// bu tur bitti, devam?
  /** v10.5.2: birden fazla panelde eşleşme -> kullanıcı seçer (yanlış panel riski). */
  const [findMatches, setFindMatches] = useState<FindPanelMatch[]>([]);
  const findStopRef = React.useRef(false);
  /** Bir turda denenecek panel sayısı (Ayarlar'dan değiştirilebilir hale gelecek). */
  const FIND_BATCH = 40;
  const [fileName, setFileName] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // v9.13.0: Kaydedilmiş "kod kaynağı" URL'ini yükle (yoksa varsayılan = senin adresin).
  React.useEffect(() => {
    storage.getItem<string>(CODE_SOURCE_KEY, "").then((v) => {
      if (v && v.trim()) setCodeSource(v.trim());
    }).catch(() => {});
  }, []);

  /* =====================================================================
   * v10.4.0 — PANEL REHBERİ
   * Kullanıcı kodu bilmiyor ama panel ADINI tanıyor olabilir. Liste açılınca
   * tüm "kod -> panel adı" haritası tek istekte çekilir; isme dokununca kod
   * otomatik dolar.
   * ===================================================================== */
  const openPanelList = async () => {
    setPanelListOpen(true);
    if (panels.length > 0) return;      // zaten yüklü
    setPanelsLoading(true);
    setError(null);
    try {
      const list = await listPanels(codeSource);
      setPanels(list);
    } catch (e: any) {
      setError(e?.message || "Panel listesi alınamadı.");
      setPanelListOpen(false);
    } finally {
      setPanelsLoading(false);
    }
  };

  const choosePanel = (p: PanelEntry) => {
    setCodeVal(p.code);
    setPanelListOpen(false);
    setPanelSearch("");
  };

  const filteredPanels = React.useMemo(() => {
    const q = panelSearch.trim().toLocaleLowerCase("tr");
    if (!q) return panels;
    return panels.filter(
      (p) => p.name.toLocaleLowerCase("tr").includes(q) || p.code.toLowerCase().includes(q)
    );
  }, [panels, panelSearch]);

  /* =====================================================================
   * v10.4.0 — OTOMATİK PANEL BULMA ("Panelimi bilmiyorum")
   * Kullanıcı adı/şifre ile hangi panele ait olduğunu bulur.
   * GÜVENLİK: panel başına TEK deneme, ilk eşleşmede dur, kullanıcıdan
   * ÖNCEDEN açık onay alınır (şifre üçüncü taraf sunuculara gönderilir).
   * ===================================================================== */
  const runFind = async (offset: number) => {
    if (!xtUser.trim() || !xtPass.trim()) {
      setError("Önce kullanıcı adı ve şifreyi girin.");
      return;
    }
    setFindOpen(false);
    setFinding(true);
    setFindExhausted(false);
    setError(null);
    findStopRef.current = false;
    setFindMsg("Paneller taranıyor…");
    try {
      const res = await findPanelByCredentials(codeSource, xtUser.trim(), xtPass.trim(), {
        limit: FIND_BATCH,
        offset,
        concurrency: 6,
        onProgress: (p) => setFindMsg(`${p.tried}/${p.total} panel denendi…`),
        shouldStop: () => findStopRef.current,
      });
      setFindOffset(res.triedCount);
      setFindTotal(res.totalCount);

      if (res.matches.length === 0) {
        setFindExhausted(true);
        setFindMsg(
          res.triedCount >= res.totalCount
            ? "Hiçbir panelde bulunamadı."
            : `Bu ${res.triedCount} panelde bulunamadı.`
        );
      } else if (res.matches.length === 1) {
        /**
         * TEK EŞLEŞME — yine de ONAY istiyoruz. Aynı kullanıcı adı/şifre
         * başka bir sağlayıcıda da geçerli olabilir; kullanıcı kendi
         * paketini (bitiş tarihi vb.) görüp doğrulasın.
         */
        const m = res.matches[0];
        setFindMsg("");
        setFindExhausted(false);
        const info = describeAccount(m.login?.user_info);
        Alert.alert(
          "Panel bulundu",
          `Panel: ${m.panelName}\nSunucu kodu: ${m.code}${info ? `\n${info}` : ""}\n\nBu sizin paneliniz mi?`,
          [
            { text: "Hayır", style: "cancel" },
            { text: "Evet, kullan", onPress: () => setCodeVal(m.code) },
          ]
        );
      } else {
        /**
         * ÇOKLU EŞLEŞME (v10.5.2) — KRİTİK GÜVENLİK NOKTASI.
         * "ali/12345" gibi yaygın bilgiler birden fazla panelde geçerli
         * olabiliyor. İlkini doğru saymak, kullanıcıya YABANCI sağlayıcının
         * listesini yükletir (ve başkasının hesabına giriş demektir).
         * Bu yüzden seçimi kullanıcı yapar; ayırt etmesi için her adayın
         * hesap özeti (bitiş tarihi, bağlantı) gösterilir.
         */
        setFindMatches(res.matches);
        setFindMsg("");
        setFindExhausted(false);
      }
    } catch (e: any) {
      setError(e?.message || "Panel araması başarısız.");
    } finally {
      setFinding(false);
    }
  };

  /* v10.4.0 — AKILLI YAPIŞTIRMA: tam get.php/player_api adresinden bilgileri ayıkla. */
  const smartPaste = async () => {
    try {
      const txt = await Clipboard.getStringAsync();
      const parsed = parseXtreamUrl(txt);
      if (!parsed) {
        setError("Panoda geçerli bir adres bulunamadı. Sağlayıcınızın gönderdiği tam adresi kopyalayın.");
        return;
      }
      setXtUser(parsed.username);
      setXtPass(parsed.password);
      setXtServer(parsed.server);
      setMethod("xtream");
      setError(null);
      Alert.alert("Bilgiler dolduruldu", `Sunucu: ${parsed.server}\nKullanıcı: ${parsed.username}`);
    } catch {
      setError("Pano okunamadı.");
    }
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["*/*"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setFileName(asset.name);
      const response = await fetch(asset.uri);
      const text = await response.text();
      setFileContent(text);
    } catch (e: any) {
      setError("Dosya seçilemedi: " + e.message);
    }
  };

  const useDemo = () => {
    setMethod("m3u_url");
    setName("iptv-org (Demo)");
    setM3uUrl("https://iptv-org.github.io/iptv/countries/tr.m3u");
  };

  /**
   * Algılanan Xtream bilgileriyle DOĞRUDAN yükler.
   * (setState asenkron olduğu için state'e güvenmeden yerel değerlerle çalışır.)
   */
  const submitXtreamDirect = async (cred: { server: string; username: string; password: string }) => {
    setLoading(true);
    setProgress("Kimlik doğrulanıyor (Xtream)...");
    try {
      const id = `pl-${Date.now()}`;
      const login = await xtLoginLocal(cred);
      setProgress("Kanallar, filmler ve diziler paralel yükleniyor...");
      const [chRes, vodRes, serRes] = await Promise.allSettled([
        xtreamLiveStreams(cred),
        xtVodLocal(cred),
        xtSeriesLocal(cred),
      ]);
      const channels = chRes.status === "fulfilled" ? chRes.value : [];
      const vod = vodRes.status === "fulfilled" ? vodRes.value : [];
      const series = serRes.status === "fulfilled" ? serRes.value : [];
      if (chRes.status === "rejected" && vod.length === 0 && series.length === 0) {
        throw new Error("İçerik yüklenemedi. Sunucu veya bilgileri kontrol edin.");
      }
      const playlist: Playlist = {
        id, name: name.trim() || "Xtream Codes", source: "xtream",
        xtreamServer: cred.server, xtreamUsername: cred.username, xtreamPassword: cred.password,
        accountInfo: login.user_info as AccountInfo,
        serverInfo: login.server_info || null,
        channels, vod, series,
        createdAt: new Date().toISOString(),
      };
      const total = channels.length + vod.length + series.length;
      if (total === 0) throw new Error("Hiç içerik bulunamadı. Kaynağı kontrol edin.");
      await addPlaylist(playlist);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  /** Kullanıcıya Evet/Hayır sorar (Promise tabanlı). */
  const askYesNo = (title: string, message: string): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        title,
        message,
        [
          { text: "Hayır, M3U olarak ekle", onPress: () => resolve(false), style: "cancel" },
          { text: "Evet, Xtream olarak ekle", onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });

  const submit = async () => {
    setError(null);

    // XTREAM OTOMATİK ALGILAMA (kullanıcı isteği):
    // M3U URL'i aslında bir Xtream portalı (get.php / player_api.php) ise,
    // kullanıcıya sor. Kabul ederse Xtream moduna geçir — kategoriler, EPG ve
    // hesap bilgisi gibi çok daha zengin veri gelir.
    if (method === "m3u_url" && m3uUrl.trim()) {
      const detected = detectXtreamFromM3U(m3uUrl.trim());
      if (detected) {
        const useXtream = await askYesNo(
          "Xtream Portalı Algılandı",
          "Girdiğiniz bağlantı bir Xtream Codes portalı gibi görünüyor. Xtream olarak eklerseniz kategoriler, EPG ve hesap bilgileri de yüklenir. Nasıl eklemek istersiniz?"
        );
        if (useXtream) {
          // Alanları doldur ve Xtream moduna geç, sonra normal akış devam etsin.
          setMethod("xtream");
          setXtServer(detected.server);
          setXtUser(detected.username);
          setXtPass(detected.password);
          // Not: state güncellemesi asenkron; bu yüzden aşağıda yerel değişkenlerle
          // devam etmek için doğrudan Xtream yükleme akışını burada tetikliyoruz.
          await submitXtreamDirect(detected);
          return;
        }
        // Hayır dediyse normal M3U akışıyla devam eder.
      }
    }

    setLoading(true);
    setProgress("");
    try {
      const id = `pl-${Date.now()}`;
      let playlist: Playlist;

      if (method === "m3u_url") {
        if (!m3uUrl.trim()) throw new Error("M3U URL boş olamaz");
        setProgress("Kanallar yükleniyor (cihazdan doğrudan)...");
        const res = await fetchAndParseM3U(m3uUrl.trim());
        playlist = {
          id, name: name.trim() || "M3U Listesi", source: "m3u_url",
          m3uUrl: m3uUrl.trim(),
          channels: res.channels,
          vod: res.vod,
          series: res.series,
          createdAt: new Date().toISOString(),
        };
      } else if (method === "m3u_file") {
        if (!fileContent) throw new Error("Lütfen bir M3U dosyası seçin");
        setProgress("Kanallar ayrıştırılıyor...");
        const res = parseM3U(fileContent);
        playlist = {
          id, name: name.trim() || fileName || "M3U Dosyası", source: "m3u_file",
          channels: res.channels,
          vod: res.vod,
          series: res.series,
          createdAt: new Date().toISOString(),
        };
      } else if (method === "xtream") {
        if (!xtServer.trim() || !xtUser.trim() || !xtPass.trim())
          throw new Error("Sunucu, kullanıcı adı ve şifre gereklidir");
        setProgress("Kimlik doğrulanıyor (cihazdan doğrudan)...");
        const cred = { server: xtServer.trim(), username: xtUser.trim(), password: xtPass.trim() };
        const login = await xtLoginLocal(cred);

        // HIZ: Kanallar + Filmler + Diziler ARTIK PARALEL yükleniyor (IPTV Extreme gibi).
        // ESKİ: art arda await -> kanallar bitmeden filmler başlamıyordu (3x yavaş).
        // YENİ: Promise.allSettled -> üçü aynı anda; biri yoksa (VOD/Series olmayan
        // sağlayıcı) diğerleri yine yüklenir, hata tüm işlemi durdurmaz.
        setProgress("Kanallar, filmler ve diziler paralel yükleniyor...");
        const [chRes, vodRes, serRes] = await Promise.allSettled([
          xtreamLiveStreams(cred),
          xtVodLocal(cred),
          xtSeriesLocal(cred),
        ]);

        const channels = chRes.status === "fulfilled" ? chRes.value : [];
        const vod = vodRes.status === "fulfilled" ? vodRes.value : [];
        const series = serRes.status === "fulfilled" ? serRes.value : [];

        if (chRes.status === "rejected" && vod.length === 0 && series.length === 0) {
          // Hiçbiri gelmediyse gerçek bir bağlantı sorunu var.
          throw new Error("İçerik yüklenemedi. Sunucu veya bilgileri kontrol edin.");
        }

        playlist = {
          id, name: name.trim() || "Xtream Codes", source: "xtream",
          xtreamServer: xtServer.trim(), xtreamUsername: xtUser.trim(), xtreamPassword: xtPass.trim(),
          accountInfo: login.user_info as AccountInfo,
          serverInfo: login.server_info || null,
          channels, vod, series,
          createdAt: new Date().toISOString(),
        };
      } else if (method === "code") {
        /**
         * SUNUCU KODU İLE GİRİŞ (v9.13.0)
         * Kısa kod + kullanıcı adı + şifre -> uzak kaynaktan panel/DNS çözülür
         * (src/utils/serverCode.ts) -> çalışan DNS ile STANDART Xtream listesi
         * oluşturulur. Kaynak URL varsayılanı uygulama sahibinindir ama
         * değiştirilebilir; girilen değer hatırlanır.
         */
        if (!codeVal.trim() || !xtUser.trim() || !xtPass.trim())
          throw new Error("Panel kodu, kullanıcı adı ve şifre gereklidir");
        const src = codeSource.trim() || DEFAULT_CODE_SOURCE;
        await storage.setItem(CODE_SOURCE_KEY, src);

        setProgress("Panel kodu çözülüyor...");
        const { server, login: codeLogin } = await resolveServerCode(
          src, codeVal.trim(), xtUser.trim(), xtPass.trim()
        );
        const cred = { server, username: xtUser.trim(), password: xtPass.trim() };

        setProgress("Kanallar, filmler ve diziler paralel yükleniyor...");
        const [chRes, vodRes, serRes] = await Promise.allSettled([
          xtreamLiveStreams(cred), xtVodLocal(cred), xtSeriesLocal(cred),
        ]);
        const channels = chRes.status === "fulfilled" ? chRes.value : [];
        const vod = vodRes.status === "fulfilled" ? vodRes.value : [];
        const series = serRes.status === "fulfilled" ? serRes.value : [];
        if (chRes.status === "rejected" && vod.length === 0 && series.length === 0) {
          throw new Error("İçerik yüklenemedi. Kod veya kullanıcı bilgilerini kontrol edin.");
        }

        playlist = {
          id, name: name.trim() || `Sunucu ${codeVal.trim()}`, source: "xtream",
          xtreamServer: server, xtreamUsername: xtUser.trim(), xtreamPassword: xtPass.trim(),
          // v10.5.2: kodu SAKLA — DNS değişirse yenilemede kendiliğinden çözülsün.
          panelCode: codeVal.trim(), codeSource: src,
          accountInfo: codeLogin.user_info as AccountInfo,
          serverInfo: codeLogin.server_info || null,
          channels, vod, series,
          createdAt: new Date().toISOString(),
        };
      } else {
        /**
         * STALKER / MAG — ARTIK CİHAZ İÇİ (v9.1.0)
         * Eskiden backend proxy'ye bağımlıydı (emergent kalıntısı). Protokolün
         * tamamı src/utils/stalker.ts içinde cihazda çalışıyor:
         *   handshake -> get_profile -> get_genres -> get_all_channels
         * Yayın adresleri GEÇİCİ olduğu için oynatma anında create_link ile
         * ayrıca çözülür (player tarafında).
         */
        if (!stPortal.trim() || !stMac.trim())
          throw new Error("Portal adresi ve MAC adresi gereklidir");

        const { stalkerLogin: stLogin, stalkerChannels, normalizeMac } = await import("@/src/utils/stalker");
        const cred = {
          portal: stPortal.trim(),
          mac: normalizeMac(stMac.trim()),
          serial: stSerial.trim() || undefined,
        };

        setProgress("Portala bağlanılıyor...");
        const { session, profile: prof } = await stLogin(cred);

        setProgress("Kanallar yükleniyor...");
        const chans = await stalkerChannels(cred, session);
        if (chans.length === 0) {
          throw new Error(
            "Portal bağlandı ama kanal listesi BOŞ.\n\n" +
              "Olası sebepler:\n" +
              "• MAC adresi bu portalda kayıtlı değil\n" +
              "• Abonelik süresi dolmuş\n" +
              "• Portal bu cihaz türünü kabul etmiyor"
          );
        }
        const load = { channels: chans };
        const profile = prof || {};
        playlist = {
          id, name: name.trim() || "MAG Portal", source: "stalker",
          stalkerPortal: stPortal.trim(), stalkerMac: stMac.trim().toUpperCase(),
          stalkerSerial: stSerial.trim() || undefined,
          accountInfo: {
            username: profile.login,
            status: profile.status,
            mac: profile.mac,
            phone: profile.phone,
            tariff_plan: profile.tariff_plan,
            tariff_expired_date: profile.tariff_expired_date || profile.exp_billing_date,
          },
          channels: load.channels, createdAt: new Date().toISOString(),
        };
      }

      const totalItems = (playlist.channels?.length || 0) + (playlist.vod?.length || 0) + (playlist.series?.length || 0);
      if (totalItems === 0) throw new Error("Hiç kanal/film/dizi bulunamadı. Kaynağı kontrol edin.");
      await addPlaylist(playlist);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const methods: { key: Method; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "m3u_url", label: "M3U URL", icon: "link" },
    { key: "m3u_file", label: "M3U Dosya", icon: "document-attach" },
    { key: "xtream", label: "Xtream", icon: "server" },
    { key: "code", label: "Sunucu Kodu", icon: "keypad" },
    { key: "stalker", label: "MAG", icon: "hardware-chip" },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top", "bottom"]} testID="add-playlist-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <FocusButton testID="close-btn" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </FocusButton>
          <Text style={[styles.title, { color: colors.onSurface }]}>Oynatma Listesi Ekle</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxxl }} keyboardShouldPersistTaps="handled">
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary }]}>KAYNAK TÜRÜ</Text>
          <View style={styles.methodGrid}>
            {methods.map(m => {
              const active = method === m.key;
              return (
                <FocusButton
                  key={m.key}
                  testID={`method-${m.key}-btn`}
                  onPress={() => setMethod(m.key)}
                  activeOpacity={0.85}
                  focusable
                  style={[
                    styles.methodCard,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                    active && { borderColor: colors.brandPrimary, backgroundColor: colors.surfaceTertiary },
                  ]}
                >
                  <Ionicons name={m.icon} size={26} color={active ? colors.brandPrimary : colors.onSurfaceSecondary} />
                  <Text style={[styles.methodLabel, { color: active ? colors.onSurface : colors.onSurfaceSecondary }]}>{m.label}</Text>
                </FocusButton>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>LİSTE ADI (isteğe bağlı)</Text>
          <TextInput
            testID="playlist-name-input"
            value={name}
            onChangeText={setName}
            placeholder="Örn: MAG254 Aboneliğim"
            placeholderTextColor={colors.onSurfaceTertiary}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              // İsimden sonra ilgili kaynağın İLK alanına geç.
              (refM3uUrl.current || refXtServer.current || refStPortal.current)?.focus();
            }}
            style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
          />

          {method === "m3u_url" && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>M3U URL</Text>
              <TextInput
                testID="m3u-url-input"
                ref={refM3uUrl}
                value={m3uUrl}
                onChangeText={setM3uUrl}
                placeholder="https://example.com/playlist.m3u"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                blurOnSubmit
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              <FocusButton testID="use-demo-btn" onPress={useDemo} style={styles.demoRow}>
                <Ionicons name="flash" size={16} color={colors.brandPrimary} />
                <Text style={[styles.demoText, { color: colors.brandPrimary }]}>Demo listeyi kullan (iptv-org TR)</Text>
              </FocusButton>
            </>
          )}

          {method === "m3u_file" && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>M3U DOSYASI</Text>
              <FocusButton
                testID="pick-file-btn"
                onPress={pickFile}
                style={[styles.fileBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <Ionicons name="cloud-upload-outline" size={22} color={colors.brandPrimary} />
                <Text style={[styles.fileText, { color: colors.onSurface }]} numberOfLines={1}>
                  {fileName || "Dosya seç (.m3u / .m3u8)"}
                </Text>
              </FocusButton>
            </>
          )}

          {method === "xtream" && (
            <>
              {/**
                * v10.4.0 — AKILLI YAPIŞTIRMA
                * Sağlayıcıdan gelen tam adres (…/get.php?username=…&password=…)
                * panoya kopyalanıp tek dokunuşla üç alana birden dağıtılır.
                * Yaşlı kullanıcı hiçbir alanı elle doldurmak zorunda kalmaz.
                */}
              <FocusButton
                testID="smart-paste-btn"
                onPress={smartPaste}
                style={[styles.helperBtn, { borderColor: colors.brandPrimary, marginTop: SPACING.lg }]}
              >
                <Ionicons name="clipboard" size={16} color={colors.brandPrimary} />
                <Text style={{ color: colors.brandPrimary, fontSize: FONT.size.sm, fontWeight: "600" }}>
                  Adresi yapıştır — bilgileri otomatik doldur
                </Text>
              </FocusButton>

              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>SUNUCU</Text>
              <TextInput
                testID="xtream-server-input"
                ref={refXtServer}
                value={xtServer}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refXtUser.current?.focus()}
                onChangeText={setXtServer}
                placeholder="http://sunucu.com:8080"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>KULLANICI ADI</Text>
              <TextInput
                testID="xtream-username-input"
                ref={refXtUser}
                value={xtUser}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refXtPass.current?.focus()}
                onChangeText={setXtUser}
                placeholder="kullanici_adiniz"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>ŞİFRE</Text>
              <TextInput
                testID="xtream-password-input"
                ref={refXtPass}
                value={xtPass}
                returnKeyType="done"
                onChangeText={setXtPass}
                placeholder="••••••••"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
            </>
          )}

          {method === "code" && (
            <>
              <View style={[styles.infoBanner, { backgroundColor: colors.brandPrimary + "22", borderColor: colors.brandPrimary }]}>
                <Ionicons name="keypad" size={18} color={colors.brandPrimary} />
                <Text style={{ color: colors.onSurface, flex: 1, fontSize: FONT.size.sm }}>
                  DNS adresi yerine kısa bir SUNUCU KODU girin. DNS değişse bile kod aynı kalır.
                </Text>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>PANEL KODU</Text>
              <TextInput
                testID="code-value-input"
                value={codeVal}
                onChangeText={setCodeVal}
                placeholder="Örn: 0001"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refXtUser.current?.focus()}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />

              {/**
                * v10.4.0 — KOD BİLMEYENLER İÇİN İKİ YOL
                * 1) Panel Listesi: panel ADINA dokun, kod otomatik dolsun.
                * 2) Panelimi bilmiyorum: kullanıcı adı/şifre ile paneli bul.
                */}
              <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm }}>
                <FocusButton
                  testID="panel-list-btn"
                  onPress={openPanelList}
                  style={[styles.helperBtn, { borderColor: colors.brandPrimary }]}
                >
                  <Ionicons name="list" size={16} color={colors.brandPrimary} />
                  <Text style={{ color: colors.brandPrimary, fontSize: FONT.size.sm, fontWeight: "600" }}>
                    Panel Listesi
                  </Text>
                </FocusButton>
                <FocusButton
                  testID="panel-find-btn"
                  onPress={() => setFindOpen(true)}
                  style={[styles.helperBtn, { borderColor: colors.border }]}
                >
                  <Ionicons name="search" size={16} color={colors.onSurface} />
                  <Text style={{ color: colors.onSurface, fontSize: FONT.size.sm, fontWeight: "600" }}>
                    Panelimi bilmiyorum
                  </Text>
                </FocusButton>
              </View>

              {/* Arama ilerlemesi / sonucu */}
              {(finding || findExhausted) && (
                <View style={[styles.infoBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginTop: SPACING.sm }]}>
                  {finding && <ActivityIndicator size="small" color={colors.brandPrimary} />}
                  <Text style={{ color: colors.onSurface, flex: 1, fontSize: FONT.size.sm }}>{findMsg}</Text>
                  {finding ? (
                    <FocusButton testID="panel-find-stop" onPress={() => { findStopRef.current = true; }}>
                      <Text style={{ color: colors.error, fontWeight: "700" }}>Durdur</Text>
                    </FocusButton>
                  ) : findExhausted && findOffset < findTotal ? (
                    <FocusButton testID="panel-find-more" onPress={() => runFind(findOffset)}>
                      <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>
                        Devam et ({findTotal - findOffset})
                      </Text>
                    </FocusButton>
                  ) : null}
                </View>
              )}

              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>KULLANICI ADI</Text>
              <TextInput
                testID="code-user-input"
                ref={refXtUser}
                value={xtUser}
                onChangeText={setXtUser}
                placeholder="Kullanıcı adı"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refXtPass.current?.focus()}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />

              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>ŞİFRE</Text>
              <TextInput
                testID="code-pass-input"
                ref={refXtPass}
                value={xtPass}
                onChangeText={setXtPass}
                placeholder="Şifre"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                returnKeyType="done"
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />

              {/* Kaynak URL — varsayılan uygulama sahibinindir; gelişmiş kullanıcı değiştirebilir. */}
              <FocusButton
                testID="code-source-toggle"
                onPress={() => setShowCodeSource(v => !v)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
              >
                <Ionicons name={showCodeSource ? "chevron-down" : "chevron-forward"} size={16} color={colors.onSurfaceSecondary} />
                <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm }}>Kod kaynağı (gelişmiş)</Text>
              </FocusButton>
              {showCodeSource && (
                <>
                  <TextInput
                    testID="code-source-input"
                    value={codeSource}
                    onChangeText={setCodeSource}
                    placeholder={DEFAULT_CODE_SOURCE}
                    placeholderTextColor={colors.onSurfaceTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
                  />
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: FONT.size.xs, marginTop: -4, marginBottom: 4 }}>
                    Boş bırakılırsa varsayılan kaynak kullanılır.
                  </Text>
                </>
              )}
            </>
          )}

          {method === "stalker" && (
            <>
              <View style={[styles.infoBanner, { backgroundColor: colors.brandPrimary + "22", borderColor: colors.brandPrimary }]}>
                <Ionicons name="information-circle" size={18} color={colors.brandPrimary} />
                <Text style={[styles.infoBannerText, { color: colors.onSurface }]}>
                  Sadece SİZE AİT MAG cihazının MAC adresini girin. Başkasının MAC adresini kullanmak yasadışıdır.
                </Text>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>PORTAL URL</Text>
              <TextInput
                testID="stalker-portal-input"
                ref={refStPortal}
                value={stPortal}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refStMac.current?.focus()}
                onChangeText={setStPortal}
                placeholder="http://portal.saglayici.com"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>MAC ADRESİ</Text>
              <TextInput
                testID="stalker-mac-input"
                ref={refStMac}
                value={stMac}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refStSerial.current?.focus()}
                onChangeText={t => setStMac(t.toUpperCase())}
                placeholder="00:1A:79:AA:BB:CC"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.md }]}>
                SERIAL NUMBER (isteğe bağlı)
              </Text>
              <TextInput
                testID="stalker-serial-input"
                ref={refStSerial}
                value={stSerial}
                returnKeyType="done"
                onChangeText={setStSerial}
                placeholder="062015N001999"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
            </>
          )}

          {error && (
            <View testID="error-box" style={[styles.errorBox, { backgroundColor: colors.error + "22", borderColor: colors.error }]}>
              <View style={{ flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" }}>
                <Ionicons name="alert-circle" size={18} color={colors.error} style={{ marginTop: 2 }} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
              {/sunucu|ulaş|network|erişil|internet/i.test(error) && (
                <FocusButton
                  testID="error-diagnostic-btn"
                  onPress={() => router.push("/diagnostic")}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center",
                    gap: 6, marginTop: SPACING.sm, paddingVertical: SPACING.sm,
                    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: colors.error,
                  }}
                >
                  <Ionicons name="pulse" size={16} color={colors.error} />
                  <Text style={{ color: colors.error, fontWeight: FONT.weight.bold }}>Bağlantıyı Test Et</Text>
                </FocusButton>
              )}
            </View>
          )}

          {loading && progress && (
            <View style={[styles.progressBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.brandPrimary} />
              <Text style={[styles.progressText, { color: colors.onSurface }]}>{progress}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <FocusButton
            testID="submit-playlist-btn"
            onPress={submit}
            disabled={loading}
            activeOpacity={0.85}
            style={[styles.cta, { backgroundColor: colors.brandPrimary, opacity: loading ? 0.7 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color={colors.onBrandPrimary} />
                <Text style={[styles.ctaText, { color: colors.onBrandPrimary }]}>Kaydet ve Yükle</Text>
              </>
            )}
          </FocusButton>
        </View>
      </KeyboardAvoidingView>

      {/* =================== v10.4.0: PANEL LİSTESİ =================== */}
      <Modal visible={panelListOpen} transparent animationType="slide" onRequestClose={() => setPanelListOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Panel Listesi</Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm, marginBottom: SPACING.sm }}>
              Panelinizin adına dokunun; sunucu kodu otomatik dolacak.
            </Text>
            <TextInput
              testID="panel-search-input"
              value={panelSearch}
              onChangeText={setPanelSearch}
              placeholder="Panel adı veya kod ara…"
              placeholderTextColor={colors.onSurfaceTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
            />
            {panelsLoading ? (
              <View style={{ padding: SPACING.lg, alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.brandPrimary} />
                <Text style={{ color: colors.onSurfaceSecondary, marginTop: SPACING.sm }}>Liste yükleniyor…</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 380, marginTop: SPACING.sm }} keyboardShouldPersistTaps="handled">
                {filteredPanels.length === 0 ? (
                  <Text style={{ color: colors.onSurfaceSecondary, padding: SPACING.md, textAlign: "center" }}>
                    Eşleşen panel yok.
                  </Text>
                ) : (
                  filteredPanels.map((p) => (
                    <FocusButton
                      key={p.code}
                      testID={`panel-item-${p.code}`}
                      onPress={() => choosePanel(p)}
                      style={[styles.panelRow, { borderColor: colors.border }]}
                    >
                      <Ionicons name="server" size={18} color={colors.brandPrimary} />
                      <Text style={{ color: colors.onSurface, flex: 1, fontSize: FONT.size.base }} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm }}>{p.code}</Text>
                    </FocusButton>
                  ))
                )}
              </ScrollView>
            )}
            <FocusButton
              testID="panel-list-close"
              onPress={() => setPanelListOpen(false)}
              style={[styles.modalClose, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Kapat</Text>
            </FocusButton>
          </View>
        </View>
      </Modal>

      {/* ========== v10.4.0: OTOMATİK BULMA — AÇIK ONAY EKRANI ==========
          Kullanıcının şifresi, ait olmadığı panellere de gönderilecek.
          Bu yüzden aramadan ÖNCE açıkça bilgilendirip onay alıyoruz. */}
      <Modal visible={findOpen} transparent animationType="fade" onRequestClose={() => setFindOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Panelimi bul</Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm, lineHeight: 20 }}>
              Kullanıcı adınız ve şifreniz, doğru paneli bulmak için panellere sırayla denenecek.
              Her panele yalnızca bir kez denenir ve panel bulununca arama durur.
              {"\n\n"}Bu işlem sırasında bilgileriniz denenen sunuculara gönderilir. Devam etmek istiyor musunuz?
            </Text>
            <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg }}>
              <FocusButton
                testID="find-cancel"
                onPress={() => setFindOpen(false)}
                style={[styles.modalClose, { flex: 1, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Vazgeç</Text>
              </FocusButton>
              <FocusButton
                testID="find-start"
                onPress={() => { setFindOffset(0); runFind(0); }}
                style={[styles.modalClose, { flex: 1, backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
              >
                <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>Aramayı başlat</Text>
              </FocusButton>
            </View>
          </View>
        </View>
      </Modal>
      {/* ===== v10.5.2: ÇOKLU EŞLEŞME — KULLANICI KENDİ PANELİNİ SEÇER ===== */}
      <Modal
        visible={findMatches.length > 0}
        transparent
        animationType="slide"
        onRequestClose={() => setFindMatches([])}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Birden fazla panel bulundu</Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm, lineHeight: 20 }}>
              Aynı kullanıcı adı ve şifre {findMatches.length} panelde geçerli görünüyor.
              Lütfen KENDİ paketinizi seçin — yanlış seçim başka bir sağlayıcının listesini yükler.
              Abonelik bitiş tarihiniz seçim yapmanıza yardımcı olur.
            </Text>
            <ScrollView style={{ maxHeight: 340, marginTop: SPACING.md }}>
              {findMatches.map((m) => {
                const info = describeAccount(m.login?.user_info);
                return (
                  <FocusButton
                    key={`${m.code}-${m.panelName}`}
                    testID={`find-match-${m.code}`}
                    onPress={() => { setCodeVal(m.code); setFindMatches([]); }}
                    style={[styles.panelRow, { borderColor: colors.border }]}
                  >
                    <Ionicons name="server" size={18} color={colors.brandPrimary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.onSurface, fontSize: FONT.size.base }} numberOfLines={1}>
                        {m.panelName}
                      </Text>
                      {!!info && (
                        <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.xs }} numberOfLines={1}>
                          {info}
                        </Text>
                      )}
                    </View>
                    <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm }}>{m.code}</Text>
                  </FocusButton>
                );
              })}
            </ScrollView>
            <FocusButton
              testID="find-match-cancel"
              onPress={() => setFindMatches([])}
              style={[styles.modalClose, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Hiçbiri / Vazgeç</Text>
            </FocusButton>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
  sectionLabel: {
    fontSize: FONT.size.xs,
    fontWeight: FONT.weight.bold,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  methodGrid: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
  methodCard: {
    width: "23%",
    minWidth: 74,
    flexGrow: 1,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
    gap: SPACING.xs,
  },
  methodLabel: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    fontSize: FONT.size.lg,
  },
  demoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.sm },
  demoText: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
  fileBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    height: 52, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg,
  },
  fileText: { fontSize: FONT.size.base, flex: 1 },
  infoBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1,
    marginTop: SPACING.md,
  },
  infoBannerText: { flex: 1, fontSize: FONT.size.sm, lineHeight: 18 },
  /* ---- v10.4.0: panel rehberi / otomatik bulma ---- */
  helperBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.xs, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: SPACING.lg,
  },
  modalSheet: {
    borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.lg,
  },
  modalTitle: { fontSize: FONT.size.lg, fontWeight: "700", marginBottom: SPACING.xs },
  modalClose: {
    alignItems: "center", justifyContent: "center",
    paddingVertical: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, marginTop: SPACING.md,
  },
  panelRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1, borderRadius: RADIUS.sm,
  },
  errorBox: {
    borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.lg,
  },
  errorText: { flex: 1, fontSize: FONT.size.base, lineHeight: 20 },
  progressBox: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.lg,
  },
  progressText: { fontSize: FONT.size.base },
  footer: { padding: SPACING.lg, borderTopWidth: 1 },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    height: 56, borderRadius: RADIUS.pill,
  },
  ctaText: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
});
