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

type Method = "m3u_url" | "m3u_file" | "xtream" | "stalker";

export default function AddPlaylist() {
  /**
   * ALAN ARASI GEÇİŞ (v9.3.0 — kullanıcı isteği)
   * Telefon/tablette klavyedeki "İleri" tuşu, TV'de kumanda OK tuşu bir
   * sonraki alana geçirir. Eskiden her alanı elle seçmek gerekiyordu.
   */
  const refM3uUrl = React.useRef<any>(null);
  const refDemoBtn = React.useRef<any>(null);
  const refSubmitBtn = React.useRef<any>(null);
  const refXtUser = React.useRef<any>(null);
  const refXtPass = React.useRef<any>(null);
  const refStMac = React.useRef<any>(null);
  const refStSerial = React.useRef<any>(null);

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
  const [fileName, setFileName] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

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
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refDemoBtn.current?.focus?.()}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              <FocusButton ref={refDemoBtn} testID="use-demo-btn" onPress={useDemo} style={styles.demoRow}>
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
            ref={refSubmitBtn}
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
