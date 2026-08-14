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
import type { Playlist, AccountInfo, ServerCodeBinding } from "@/src/types";
import { FocusButton } from "@/src/components/FocusButton";
import {
  resolveServerCode, DEFAULT_CODE_SOURCE, CODE_SOURCE_KEY,
  fetchPanelDirectory, discoverPanelsByCredentials,
  type PanelDirectoryItem, type PanelCredentialMatch,
} from "@/src/utils/serverCode";
import { storage } from "@/src/utils/storage";

type Method = "m3u_url" | "m3u_file" | "xtream" | "stalker" | "code";
type CodeMode = "code" | "directory" | "auto";

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
  // GPT v10.5.0: Yaşlı/teknik olmayan kullanıcılar için üç kolay sunucu-kodu yolu.
  const [codeMode, setCodeMode] = useState<CodeMode>("code");
  const [panelDirectory, setPanelDirectory] = useState<PanelDirectoryItem[]>([]);
  const [panelSearch, setPanelSearch] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [selectedPanelName, setSelectedPanelName] = useState("");
  // GPT v10.5.1: aynı kullanıcı/şifre birden fazla panelde bulunursa
  // otomatik karar VERME; kullanıcı doğru aboneliği seçsin.
  const [discoveryMatches, setDiscoveryMatches] = useState<PanelCredentialMatch[]>([]);
  const [showDiscoveryMatches, setShowDiscoveryMatches] = useState(false);
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

  const formatExpiry = (raw: any): string => {
    if (raw == null || raw === "") return "Bilinmiyor";
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return String(raw);
    try {
      return new Date(n * 1000).toLocaleDateString("tr-TR");
    } catch {
      return String(raw);
    }
  };

  const accountSummary = (m: PanelCredentialMatch) => {
    const ui = m.login?.user_info || {};
    const status = String(ui.status || (ui.auth === 1 || ui.auth === "1" ? "Aktif" : "Bilinmiyor"));
    const exp = formatExpiry(ui.exp_date);
    const active = ui.active_cons ?? ui.active_connections ?? "?";
    const max = ui.max_connections ?? "?";
    return { status, exp, active, max };
  };

  const filteredPanels = React.useMemo(() => {
    const q = panelSearch.trim().toLocaleLowerCase("tr");
    if (!q) return panelDirectory.slice(0, 100);
    return panelDirectory
      .filter(p => p.panelName.toLocaleLowerCase("tr").includes(q) || p.code.toLocaleLowerCase("tr").includes(q))
      .slice(0, 100);
  }, [panelDirectory, panelSearch]);

  const loadPanelDirectory = async () => {
    if (directoryLoading) return;
    setError(null);
    setDirectoryLoading(true);
    try {
      const src = codeSource.trim() || DEFAULT_CODE_SOURCE;
      await storage.setItem(CODE_SOURCE_KEY, src);
      const list = await fetchPanelDirectory(src);
      setPanelDirectory(list);
      if (list.length === 0) throw new Error("Panel rehberi boş.");
    } catch (e: any) {
      setError(e?.message || "Panel rehberi yüklenemedi.");
    } finally {
      setDirectoryLoading(false);
    }
  };

  const choosePanel = (item: PanelDirectoryItem) => {
    setCodeVal(item.code);
    setSelectedPanelName(item.panelName);
    if (!name.trim()) setName(item.panelName);
    setCodeMode("code");
    setError(null);
    setTimeout(() => refXtUser.current?.focus?.(), 50);
  };

  const makeBinding = (
    code: string,
    panelName: string,
    server: string,
  ): ServerCodeBinding => ({
    code: String(code).trim(),
    panelName: String(panelName).trim(),
    codeSource: codeSource.trim() || DEFAULT_CODE_SOURCE,
    autoResolve: true,
    lastResolvedServer: server,
    lastResolvedAt: new Date().toISOString(),
  });

  const addDiscoveredMatch = async (found: PanelCredentialMatch) => {
    setShowDiscoveryMatches(false);
    setDiscoveryMatches([]);
    setCodeVal(found.code);
    setSelectedPanelName(found.panelName);
    if (!name.trim()) setName(found.panelName);
    setProgress(`Seçildi: ${found.panelName}. İçerik yükleniyor...`);

    await submitXtreamDirect(
      {
        server: found.server,
        username: xtUser.trim(),
        password: xtPass.trim(),
      },
      name.trim() || found.panelName,
      makeBinding(found.code, found.panelName, found.server),
    );
  };

  const submitAutoDiscovery = async () => {
    if (!xtUser.trim() || !xtPass.trim()) {
      throw new Error("Kullanıcı adı ve şifre gereklidir");
    }

    const src = codeSource.trim() || DEFAULT_CODE_SOURCE;
    await storage.setItem(CODE_SOURCE_KEY, src);
    setDiscoveryMatches([]);
    setShowDiscoveryMatches(false);
    setProgress("Panel rehberi yükleniyor...");

    const matches = await discoverPanelsByCredentials(
      src,
      xtUser.trim(),
      xtPass.trim(),
      (p) => {
        const pct = p.total > 0 ? Math.round((p.tested / p.total) * 100) : 0;
        setProgress(`Tüm paneller taranıyor... %${pct}${p.panelName ? ` · ${p.panelName}` : ""}`);
      },
      5,
    );

    if (matches.length === 1) {
      await addDiscoveredMatch(matches[0]);
      return;
    }

    // Birden fazla geçerli abonelik: ilk bulduğumuzu yanlışlıkla ekleme.
    // Kullanıcı doğru paneli açıkça seçene kadar hiçbir playlist oluşturulmaz.
    setDiscoveryMatches(matches);
    setShowDiscoveryMatches(true);
    setLoading(false);
    setProgress("");
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
  const submitXtreamDirect = async (
    cred: { server: string; username: string; password: string },
    displayName?: string,
    serverCodeBinding?: ServerCodeBinding,
  ) => {
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
        id, name: displayName?.trim() || name.trim() || "Xtream Codes", source: "xtream",
        xtreamServer: cred.server, xtreamUsername: cred.username, xtreamPassword: cred.password,
        serverCodeBinding,
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
      // GPT v10.5.0: "Paneli bilmiyorum" yolunda kullanıcı yalnız kullanıcı
      // adı + şifre verir. Firebase yalnız katalog olarak kullanılır; kimlik
      // bilgileri doğrudan aday Xtream sunucularına gider.
      if (method === "code" && codeMode === "auto") {
        await submitAutoDiscovery();
        return;
      }
      if (method === "code" && codeMode === "directory" && !codeVal.trim()) {
        throw new Error("Panel rehberinden bir panel seçin veya 'Kodum var' seçeneğine dönün.");
      }

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
          id, name: displayName?.trim() || name.trim() || "Xtream Codes", source: "xtream",
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
        const { panelName: resolvedPanelName, server, login: codeLogin } = await resolveServerCode(
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
          id, name: name.trim() || selectedPanelName || resolvedPanelName || `Sunucu ${codeVal.trim()}`, source: "xtream",
          xtreamServer: server, xtreamUsername: xtUser.trim(), xtreamPassword: xtPass.trim(),
          serverCodeBinding: makeBinding(codeVal.trim(), resolvedPanelName, server),
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
                <Ionicons name="people" size={18} color={colors.brandPrimary} />
                <Text style={{ color: colors.onSurface, flex: 1, fontSize: FONT.size.sm }}>
                  Panel kodunu bilmiyorsanız sorun değil. Panel adından seçebilir veya yalnız kullanıcı adı ve şifre ile hesabınızı otomatik aratabilirsiniz.
                </Text>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>NASIL EKLEMEK İSTİYORSUNUZ?</Text>
              <View style={styles.codeModeGrid}>
                {([
                  { key: "code" as CodeMode, label: "Kodum var", icon: "keypad" as const },
                  { key: "directory" as CodeMode, label: "Paneli biliyorum", icon: "list" as const },
                  { key: "auto" as CodeMode, label: "Paneli bilmiyorum", icon: "search" as const },
                ]).map(opt => {
                  const active = codeMode === opt.key;
                  return (
                    <FocusButton
                      key={opt.key}
                      testID={`code-mode-${opt.key}`}
                      focusable
                      onPress={() => {
                        setCodeMode(opt.key);
                        setError(null);
                        if (opt.key === "directory" && panelDirectory.length === 0) void loadPanelDirectory();
                      }}
                      style={[
                        styles.codeModeCard,
                        { backgroundColor: colors.surfaceSecondary, borderColor: active ? colors.brandPrimary : colors.border },
                        active && { backgroundColor: colors.surfaceTertiary },
                      ]}
                    >
                      <Ionicons name={opt.icon} size={22} color={active ? colors.brandPrimary : colors.onSurfaceSecondary} />
                      <Text style={{ color: active ? colors.onSurface : colors.onSurfaceSecondary, fontWeight: FONT.weight.semibold, textAlign: "center" }}>
                        {opt.label}
                      </Text>
                    </FocusButton>
                  );
                })}
              </View>

              {codeMode === "directory" && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>PANEL / SUNUCU REHBERİ</Text>
                  <TextInput
                    testID="panel-directory-search"
                    value={panelSearch}
                    onChangeText={setPanelSearch}
                    placeholder="Panel adı veya sunucu kodu ara"
                    placeholderTextColor={colors.onSurfaceTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
                  />
                  <FocusButton
                    testID="panel-directory-refresh"
                    onPress={loadPanelDirectory}
                    disabled={directoryLoading}
                    style={[styles.directoryRefresh, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
                  >
                    {directoryLoading ? <ActivityIndicator color={colors.brandPrimary} /> : <Ionicons name="refresh" size={18} color={colors.brandPrimary} />}
                    <Text style={{ color: colors.onSurface, fontWeight: FONT.weight.semibold }}>
                      {directoryLoading ? "Rehber yükleniyor..." : `Rehberi Yenile${panelDirectory.length ? ` (${panelDirectory.length})` : ""}`}
                    </Text>
                  </FocusButton>

                  {panelDirectory.length > 0 && (
                    <View style={[styles.directoryBox, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                      {filteredPanels.length === 0 ? (
                        <Text style={{ color: colors.onSurfaceSecondary, padding: SPACING.md }}>Eşleşen panel bulunamadı.</Text>
                      ) : filteredPanels.map(item => (
                        <FocusButton
                          key={`${item.code}-${item.panelName}`}
                          testID={`panel-directory-${item.code}`}
                          focusable
                          onPress={() => choosePanel(item)}
                          style={[styles.directoryRow, { borderBottomColor: colors.border }]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.onSurface, fontWeight: FONT.weight.bold, fontSize: FONT.size.base }}>{item.panelName}</Text>
                            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm }}>
                              Sunucu kodu: {item.code} · {item.hosts.length} adres
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={colors.brandPrimary} />
                        </FocusButton>
                      ))}
                    </View>
                  )}
                  {panelDirectory.length > 100 && !panelSearch.trim() && (
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: FONT.size.xs, marginTop: SPACING.xs }}>
                      İlk 100 panel gösteriliyor. Panel adını yazarak tüm rehberde arayabilirsiniz.
                    </Text>
                  )}
                </>
              )}

              {codeMode === "auto" && (
                <>
                  <View style={[styles.infoBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <Ionicons name="shield-checkmark" size={18} color={colors.brandPrimary} />
                    <Text style={{ color: colors.onSurface, flex: 1, fontSize: FONT.size.sm }}>
                      Kullanıcı adı ve şifreniz Firebase'e gönderilmez. Uygulama Firebase'den yalnız panel/sunucu rehberini alır ve giriş bilgilerini cihazınızdan doğrudan aday IPTV sunucularında dener.
                    </Text>
                  </View>
                  <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>KULLANICI ADI</Text>
                  <TextInput
                    testID="auto-panel-user-input"
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
                    testID="auto-panel-pass-input"
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
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: FONT.size.xs, marginTop: SPACING.sm, lineHeight: 18 }}>
                    Otomatik arama tüm panel rehberini tarar. Tek eşleşme varsa doğrudan ekler; birden fazla panelde aynı kullanıcı adı/şifre geçerliyse doğru aboneliği sizin seçmenizi ister.
                  </Text>
                </>
              )}

              {codeMode === "code" && (
                <>
                  {selectedPanelName ? (
                    <View style={[styles.selectedPanel, { backgroundColor: colors.brandPrimary + "18", borderColor: colors.brandPrimary }]}>
                      <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.onSurface, fontWeight: FONT.weight.bold }}>{selectedPanelName}</Text>
                        <Text style={{ color: colors.onSurfaceSecondary }}>Sunucu kodu: {codeVal}</Text>
                      </View>
                      <FocusButton onPress={() => { setSelectedPanelName(""); setCodeVal(""); setCodeMode("directory"); }}>
                        <Text style={{ color: colors.brandPrimary, fontWeight: FONT.weight.bold }}>Değiştir</Text>
                      </FocusButton>
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.sectionLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>PANEL KODU</Text>
                      <TextInput
                        testID="code-value-input"
                        value={codeVal}
                        onChangeText={t => { setCodeVal(t); setSelectedPanelName(""); }}
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
                    </>
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
                </>
              )}

              {/* Kaynak URL — varsayılan uygulama sahibinindir; gelişmiş kullanıcı değiştirebilir. */}
              <FocusButton
                testID="code-source-toggle"
                onPress={() => setShowCodeSource(v => !v)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, marginTop: SPACING.sm }}
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

        <Modal
          visible={showDiscoveryMatches}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowDiscoveryMatches(false);
            setDiscoveryMatches([]);
          }}
        >
          <View style={styles.matchModalBackdrop}>
            <View style={[styles.matchModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.matchModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.matchModalTitle, { color: colors.onSurface }]}>
                    Birden Fazla Panel Bulundu
                  </Text>
                  <Text style={{ color: colors.onSurfaceSecondary, marginTop: 4, lineHeight: 18 }}>
                    Aynı kullanıcı adı ve şifre birden fazla panelde geçerli. Satın aldığınız doğru paneli seçin.
                  </Text>
                </View>
                <FocusButton
                  testID="discovery-match-close"
                  focusable
                  onPress={() => {
                    setShowDiscoveryMatches(false);
                    setDiscoveryMatches([]);
                  }}
                  style={styles.matchCloseBtn}
                >
                  <Ionicons name="close" size={24} color={colors.onSurface} />
                </FocusButton>
              </View>

              <ScrollView
                style={{ maxHeight: 480 }}
                contentContainerStyle={{ gap: SPACING.sm, paddingBottom: SPACING.sm }}
                keyboardShouldPersistTaps="handled"
              >
                {discoveryMatches.map((m, index) => {
                  const info = accountSummary(m);
                  return (
                    <FocusButton
                      key={`${m.code}-${m.panelName}-${m.server}`}
                      testID={`discovery-match-${index}`}
                      focusable
                      autoFocus={index === 0}
                      onPress={() => void addDiscoveredMatch(m)}
                      style={[
                        styles.matchRow,
                        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.onSurface, fontWeight: FONT.weight.bold, fontSize: FONT.size.base }}>
                          {m.panelName}
                        </Text>
                        <Text style={{ color: colors.onSurfaceSecondary, marginTop: 2 }}>
                          Sunucu kodu: {m.code}
                        </Text>
                        <Text style={{ color: colors.onSurfaceSecondary, marginTop: 2 }}>
                          Durum: {info.status} · Bitiş: {info.exp}
                        </Text>
                        <Text style={{ color: colors.onSurfaceTertiary, marginTop: 2, fontSize: FONT.size.xs }}>
                          Bağlantı: {info.active}/{info.max} · {m.server}
                        </Text>
                      </View>
                      <View style={[styles.matchSelectBadge, { backgroundColor: colors.brandPrimary + "18" }]}>
                        <Text style={{ color: colors.brandPrimary, fontWeight: FONT.weight.bold }}>Seç</Text>
                      </View>
                    </FocusButton>
                  );
                })}
              </ScrollView>

              <View style={[styles.infoBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginTop: SPACING.md }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.brandPrimary} />
                <Text style={{ color: colors.onSurface, flex: 1, fontSize: FONT.size.sm }}>
                  Seçtiğiniz panelin kimliği cihazda kaydedilir. Sonraki DNS değişikliklerinde yalnız bu panelin yeni adresleri denenir.
                </Text>
              </View>
            </View>
          </View>
        </Modal>

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
                <Ionicons name={method === "code" && codeMode === "auto" ? "search" : "checkmark-circle"} size={22} color={colors.onBrandPrimary} />
                <Text style={[styles.ctaText, { color: colors.onBrandPrimary }]}>
                  {method === "code" && codeMode === "auto" ? "Hesabımı Bul ve Ekle" : "Kaydet ve Yükle"}
                </Text>
              </>
            )}
          </FocusButton>
        </View>
      </KeyboardAvoidingView>
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
  codeModeGrid: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
  codeModeCard: {
    flex: 1,
    minWidth: 120,
    minHeight: 78,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  directoryRefresh: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    minHeight: 46,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  directoryBox: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    marginTop: SPACING.sm,
  },
  directoryRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
  },
  selectedPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  infoBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1,
    marginTop: SPACING.md,
  },
  infoBannerText: { flex: 1, fontSize: FONT.size.sm, lineHeight: 18 },
  errorBox: {
    borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.lg,
  },
  errorText: { flex: 1, fontSize: FONT.size.base, lineHeight: 20 },
  progressBox: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.lg,
  },
  progressText: { fontSize: FONT.size.base },
  matchModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  matchModalCard: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "86%",
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  matchModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  matchModalTitle: {
    fontSize: FONT.size.lg,
    fontWeight: FONT.weight.bold,
  },
  matchCloseBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.pill,
  },
  matchRow: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  matchSelectBadge: {
    minWidth: 54,
    minHeight: 36,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
  },
  footer: { padding: SPACING.lg, borderTopWidth: 1 },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    height: 56, borderRadius: RADIUS.pill,
  },
  ctaText: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
});
