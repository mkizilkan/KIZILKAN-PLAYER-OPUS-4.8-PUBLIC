import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useTheme } from "@/src/theme/ThemeContext";
import { THEMES, THEME_LABELS, ThemeName, SPACING, RADIUS, FONT } from "@/src/theme/themes";
import { usePlaylists } from "@/src/store/PlaylistContext";
import { useProfiles } from "@/src/store/ProfileContext";
import { useParental } from "@/src/store/ParentalContext";
import { useLibrary } from "@/src/store/LibraryContext";
import { isValidPinFormat, ensureRecoveryCode } from "@/src/utils/pin";
import { useTv } from "@/src/store/TvContext";
import { fetchAndCacheEpg } from "@/src/utils/epg";
import { api } from "@/src/utils/api";
import { FocusButton } from "@/src/components/FocusButton";

export default function SettingsTab() {
  const { isTv, mode: tvMode, setMode: setTvMode } = useTv();
  const { toggleHiddenGroup, isGroupHidden, hiddenGroups, clearAllProgress } = useLibrary();
  const router = useRouter();
  const { colors, themeName, setTheme } = useTheme();
  const { playlists, activePlaylist, setActivePlaylist, removePlaylist, updatePlaylist } = usePlaylists();
  const { profiles, activeProfile, switchProfile, removeProfile, setPin: setProfPin, verifyAdminPin, adminHasPin } = useProfiles();
  const { settings: parental, setPin, clearPin, toggleCategoryLock, isCategoryLocked } = useParental();
  const [epgInput, setEpgInput] = useState<string>(activePlaylist?.epgUrl || "");
  const [epgLoading, setEpgLoading] = useState(false);
  const [epgMsg, setEpgMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Parental PIN modal
  const [pinModal, setPinModal] = useState<null | "create" | "change">(null);
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [pinErr, setPinErr] = useState<string | null>(null);

  // Category lock modal
  const [showLockModal, setShowLockModal] = useState(false);
  const [showHideModal, setShowHideModal] = useState(false);
  const [profilePinFor, setProfilePinFor] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<string | null>(null);   // silinecek profil (yönetici PIN sonrası)
  const [delPinInput, setDelPinInput] = useState("");
  const [delError, setDelError] = useState<string | null>(null);
  const [profilePinVal, setProfilePinVal] = useState("");

  // Chromecast modal
  const [showCastModal, setShowCastModal] = useState(false);
  // DVR modal
  const [showDvrModal, setShowDvrModal] = useState(false);
  // Shortcuts modal
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  // Notification modal
  const [showNotifModal, setShowNotifModal] = useState(false);
  // Siri modal
  const [showSiriModal, setShowSiriModal] = useState(false);
  // Formats modal
  const [showFormatsModal, setShowFormatsModal] = useState(false);

  React.useEffect(() => {
    setEpgInput(activePlaylist?.epgUrl || "");
    setEpgMsg(null);
  }, [activePlaylist?.id]);

  const themeKeys = Object.keys(THEMES) as ThemeName[];

  const fetchEpg = async () => {
    if (!activePlaylist) return;
    if (!epgInput.trim()) { setEpgMsg({ type: "err", text: "EPG URL girin" }); return; }
    setEpgLoading(true);
    setEpgMsg(null);
    try {
      // CİHAZ-İÇİ: XMLTV'yi doğrudan indir + ayrıştır + sakla (backend YOK).
      const res = await fetchAndCacheEpg(epgInput.trim(), activePlaylist.id);
      await updatePlaylist(activePlaylist.id, { epgUrl: epgInput.trim() });
      setEpgMsg({ type: "ok", text: `${res.count} program yüklendi` });
    } catch (e: any) {
      setEpgMsg({ type: "err", text: e.message || "EPG yüklenemedi" });
    } finally {
      setEpgLoading(false);
    }
  };

  const savePin = async () => {
    // v5.5.0: PIN 4-10 hane
    const fmt = isValidPinFormat(newPin);
    if (!fmt.ok) { setPinErr(fmt.error || "Geçersiz PIN"); return; }
    if (newPin !== newPin2) { setPinErr("PIN'ler eşleşmiyor"); return; }
    await setPin(newPin);
    setPinModal(null);
    setNewPin(""); setNewPin2(""); setPinErr(null);

    // KURTARMA KODU (v5.5.0): PIN unutulursa kilitli kalmasın diye cihaza özel
    // 10 haneli bir kod üretilir ve kullanıcıya BİR KEZ gösterilir.
    const code = await ensureRecoveryCode();
    // NOT: Ana anahtar (maymuncuk) burada GÖSTERİLMEZ — kullanıcı isteği.
    // Sessizce çalışır; ekranda yazsa herkes görebilirdi.
    Alert.alert(
      "PIN kaydedildi — Kurtarma Kodunuz",
      `Bu kodu güvenli bir yere NOT EDİN:\n\n${code}\n\n` +
        "PIN'inizi unutursanız bu kodla açabilirsiniz.",
      [{ text: "Not aldım" }]
    );
  };

  const uniqueGroups = React.useMemo(() => {
    if (!activePlaylist) return [] as string[];
    const s = new Set<string>();
    activePlaylist.channels.forEach(c => { if (c.group) s.add(c.group); });
    (activePlaylist.vod || []).forEach(c => { if (c.group) s.add(c.group); });
    (activePlaylist.series || []).forEach(c => { if (c.group) s.add(c.group); });
    return Array.from(s).sort();
  }, [activePlaylist]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]} testID="settings-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xxxl }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Ayarlar</Text>
          <View style={[styles.profileBadge, { backgroundColor: activeProfile.color }]}>
            <Text style={styles.profileBadgeText}>{activeProfile.name}</Text>
          </View>
        </View>

        {/* Hesap Bilgileri */}
        {activePlaylist?.accountInfo ? (
          <>
            <SectionTitle text="HESAP BİLGİLERİ" />
            <View style={{ paddingHorizontal: SPACING.lg }}>
              <AccountInfoCard playlist={activePlaylist} />
            </View>
          </>
        ) : null}

        {/* Tema */}
        <SectionTitle text="TEMA SEÇİMİ" />
        <View style={styles.themeGrid}>
          {themeKeys.map(key => {
            const p = THEMES[key];
            const active = themeName === key;
            return (
              <FocusButton
                key={key} testID={`theme-${key}-btn`} onPress={() => setTheme(key)} activeOpacity={0.85} focusable
                style={[styles.themeCard, { backgroundColor: p.surface, borderColor: active ? colors.brandPrimary : colors.border }]}
              >
                <View style={[styles.themeSwatch, { backgroundColor: p.brandPrimary }]} />
                <Text style={[styles.themeName, { color: p.onSurface }]}>{THEME_LABELS[key]}</Text>
                {active && (
                  <View style={styles.themeCheck}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />
                  </View>
                )}
              </FocusButton>
            );
          })}
        </View>

        {/* Gelişmiş Özellikler */}
        <SectionTitle text="GELİŞMİŞ ÖZELLİKLER" />
        <View style={{ paddingHorizontal: SPACING.lg, gap: SPACING.sm }}>
          <FocusButton
            testID="feature-multi-view-btn"
            onPress={() => router.push("/multi-view")}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="grid" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Çoklu Ekran</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>2 veya 4 kanalı aynı anda izle</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
          </FocusButton>

          <FocusButton
            testID="feature-epg-timeline-btn"
            onPress={() => router.push("/epg-timeline")}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="calendar" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>7 Günlük TV Rehberi</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>Tam ekran zaman çizelgesi</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
          </FocusButton>

          <FocusButton
            testID="feature-backup-btn"
            onPress={() => router.push("/backup")}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="cloud-upload" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Yedekleme</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>Hesapları/ayarları dışa aktar veya yükle</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
          </FocusButton>

          <FocusButton
            testID="feature-dvr-btn"
            onPress={() => setShowDvrModal(true)}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="recording" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Kayıt Alma (DVR)</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>Canlı yayını cihaza kaydet</Text>
            </View>
            <View style={[styles.miniTag, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[styles.miniTagText, { color: colors.onSurfaceSecondary }]}>YAKINDA</Text>
            </View>
          </FocusButton>

          <FocusButton
            testID="feature-downloads-btn"
            onPress={() => router.push("/downloads")}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="cloud-download" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>İndirilenler</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>Çevrimdışı film/dizi/bölüm kütüphaneniz</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
          </FocusButton>

          <FocusButton
            testID="feature-formats-btn"
            onPress={() => setShowFormatsModal(true)}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="videocam" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Desteklenen Formatlar</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>MP4, MKV, HLS/M3U8, TS, DASH — HTTP/HTTPS</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
          </FocusButton>

          <FocusButton
            testID="tv-mode-btn"
            onPress={async () => {
              const next = tvMode === "auto" ? "on" : tvMode === "on" ? "off" : "auto";
              await setTvMode(next);
              Alert.alert(
                "TV Modu",
                next === "auto" ? "Otomatik — cihaz TV ise TV düzeni kullanılır."
                  : next === "on" ? "Açık — TV düzeni her zaman kullanılır (kalın odak, güvenli kenar, uzun kontrol süresi)."
                  : "Kapalı — telefon düzeni kullanılır."
              );
            }}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="tv" size={22} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>TV Modu (kumanda)</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>
                {tvMode === "auto" ? `Otomatik${isTv ? " • TV algılandı" : " • telefon"}`
                  : tvMode === "on" ? "Açık — TV düzeni zorlanıyor"
                  : "Kapalı — telefon düzeni"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
          </FocusButton>

          <FocusButton
            testID="feature-diagnostic-btn"
            onPress={() => router.push("/diagnostic")}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="pulse" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Bağlantıyı Test Et</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>Backend erişilebilirlik kontrolü (Network hata çözümü)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
          </FocusButton>

          <FocusButton
            testID="feature-stats-btn"
            onPress={() => router.push("/stats")}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="stats-chart" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>İzleme İstatistikleri</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>Toplam süre, favori kanallar, dashboard</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
          </FocusButton>

          <FocusButton
            testID="feature-shortcuts-btn"
            onPress={() => setShowShortcutsModal(true)}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="apps" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Ana Ekran Kısayolları</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>Uygulama simgesine uzun bas → Ara/Favoriler/EPG</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
          </FocusButton>

          <FocusButton
            testID="feature-notification-btn"
            onPress={() => setShowNotifModal(true)}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="notifications" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Bildirim Paneli Kontrolü</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>Android bildirim panelinde media kontrolleri</Text>
            </View>
            <View style={[styles.miniTag, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[styles.miniTagText, { color: colors.onSurfaceSecondary }]}>NATIVE</Text>
            </View>
          </FocusButton>

          <FocusButton
            testID="feature-siri-btn"
            onPress={() => setShowSiriModal(true)}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="mic" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Siri / Google Assistant</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>Sesli komutla kanal aç</Text>
            </View>
            <View style={[styles.miniTag, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[styles.miniTagText, { color: colors.onSurfaceSecondary }]}>NATIVE</Text>
            </View>
          </FocusButton>
        </View>

        {/* Aile Planı */}
        <SectionTitle text="AİLE PLANI (PROFİLLER)" />
        <View style={{ paddingHorizontal: SPACING.lg }}>
          {profiles.map(p => {
            const isActive = p.id === activeProfile.id;
            return (
              <View key={p.id} style={[styles.profileCard, { backgroundColor: colors.surfaceSecondary, borderColor: isActive ? colors.brandPrimary : colors.border }]}>
                <View style={[styles.pAvatar, { backgroundColor: p.color }]}>
                  <Text style={styles.pAvatarText}>{p.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pName, { color: colors.onSurface }]}>{p.name}</Text>
                  <View style={styles.pMetaRow}>
                    {p.isAdmin && <View style={[styles.miniTag, { backgroundColor: "#FFB300" }]}><Text style={[styles.miniTagText, { color: "#000" }]}>YÖNETİCİ</Text></View>}
                    {p.isKids && <View style={[styles.miniTag, { backgroundColor: colors.brandPrimary }]}><Text style={styles.miniTagText}>ÇOCUK</Text></View>}
                    {p.hasPin && <Ionicons name="lock-closed" size={12} color={colors.onSurfaceSecondary} />}
                  </View>
                </View>
                {/* PROFİL PIN YÖNETİMİ (v5.6.0 — eskiden sonradan PIN konulamıyordu) */}
                <FocusButton
                  testID={`profile-pin-${p.id}`}
                  onPress={() => setProfilePinFor(p.id)}
                  style={styles.pAction}
                  hitSlop={8}
                >
                  <Ionicons
                    name={p.hasPin ? "lock-closed" : "lock-open-outline"}
                    size={18}
                    color={p.hasPin ? colors.brandPrimary : colors.onSurfaceTertiary}
                  />
                </FocusButton>
                {!isActive && (
                  <FocusButton testID={`switch-profile-${p.id}`} onPress={() => switchProfile(p.id)} style={styles.pAction}>
                    <Ionicons name="swap-horizontal" size={20} color={colors.brandPrimary} />
                  </FocusButton>
                )}
                {profiles.length > 1 && !p.isAdmin && (
                  <FocusButton
                    testID={`delete-profile-${p.id}`}
                    onPress={() => {
                      // v6.1.0 (Seçenek C): Profil silme YÖNETİCİ PIN'i ister.
                      if (adminHasPin()) {
                        setDeleteFor(p.id); setDelPinInput(""); setDelError(null);
                      } else {
                        Alert.alert("Profili sil", `"${p.name}" profili ve listeleri silinsin mi?`, [
                          { text: "Vazgeç", style: "cancel" },
                          { text: "Sil", style: "destructive", onPress: () => removeProfile(p.id) },
                        ]);
                      }
                    }}
                    style={styles.pAction}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </FocusButton>
                )}
              </View>
            );
          })}
          <FocusButton
            testID="manage-profiles-btn"
            onPress={() => router.push("/profile-select")}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="people" size={18} color={colors.brandPrimary} />
            <Text style={[styles.linkText, { color: colors.brandPrimary }]}>Profil ekle / değiştir</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
          </FocusButton>

          {/* PROFİLDEN ÇIK (v6.3.0 — kullanıcı isteği)
              Kendi profilinden çıkıp "Kim izliyor?" ekranına döner.
              PIN'li profillere geri girerken tekrar PIN sorulur. */}
          <FocusButton
            testID="logout-profile-btn"
            onPress={() => {
              Alert.alert(
                "Profilden çık",
                `"${activeProfile?.name}" profilinden çıkılacak ve profil seçme ekranına dönülecek.`,
                [
                  { text: "Vazgeç", style: "cancel" },
                  { text: "Çık", onPress: () => router.replace("/profile-select") },
                ]
              );
            }}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.onSurface} />
            <Text style={[styles.linkText, { color: colors.onSurface }]}>Profilden çık</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
          </FocusButton>

          {/* KENDİ PROFİLİNİ SİL (v6.3.0 — kullanıcı isteği)
              Yalnızca YÖNETİCİ OLMAYAN profiller kendini silebilir.
              Kullanıcı zaten kendi profilinin içinde (PIN'ini girdi), bu yüzden
              yönetici PIN'i istenmez; onay yeterlidir. */}
          {!activeProfile?.isAdmin && profiles.length > 1 && (
            <FocusButton
              testID="delete-own-profile-btn"
              onPress={() => {
                Alert.alert(
                  "Profilimi sil",
                  `"${activeProfile?.name}" profili ve ona ait TÜM listeler, favoriler ve ` +
                    "geçmiş kalıcı olarak silinecek.\n\nBu işlem geri alınamaz.",
                  [
                    { text: "Vazgeç", style: "cancel" },
                    {
                      text: "Profilimi sil",
                      style: "destructive",
                      onPress: async () => {
                        const id = activeProfile.id;
                        await removeProfile(id);
                        router.replace("/profile-select");
                      },
                    },
                  ]
                );
              }}
              style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.error ?? "#D32F2F" }]}
            >
              <Ionicons name="person-remove-outline" size={18} color={colors.error ?? "#D32F2F"} />
              <Text style={[styles.linkText, { color: colors.error ?? "#D32F2F" }]}>Profilimi sil</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
            </FocusButton>
          )}
        </View>

        {/* Ebeveyn Kontrolü */}
        <SectionTitle text="EBEVEYN KONTROLÜ" />
        <View style={{ paddingHorizontal: SPACING.lg, gap: SPACING.sm }}>
          <View style={[styles.rowCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name={parental.enabled ? "lock-closed" : "lock-open-outline"} size={20} color={parental.enabled ? colors.brandPrimary : colors.onSurfaceSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>PIN Koruması</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>
                {parental.enabled ? "Aktif - Kilitli kategoriler PIN ister" : "Pasif"}
              </Text>
            </View>
            {parental.enabled ? (
              <>
                <FocusButton testID="change-pin-btn" onPress={() => setPinModal("change")} style={styles.smallBtn}>
                  <Text style={[styles.smallBtnText, { color: colors.brandPrimary }]}>Değiştir</Text>
                </FocusButton>
                <FocusButton testID="remove-pin-btn" onPress={clearPin} style={styles.smallBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </FocusButton>
              </>
            ) : (
              <FocusButton testID="create-pin-btn" onPress={() => setPinModal("create")} style={[styles.smallBtn, { backgroundColor: colors.brandPrimary, paddingHorizontal: SPACING.md, borderRadius: RADIUS.pill }]}>
                <Text style={[styles.smallBtnText, { color: colors.onBrandPrimary }]}>PIN Oluştur</Text>
              </FocusButton>
            )}
          </View>
          {parental.enabled && (
            <>
              <FocusButton
                testID="lock-categories-btn"
                onPress={() => setShowLockModal(true)}
                style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <Ionicons name="funnel" size={18} color={colors.brandPrimary} />
                <Text style={[styles.linkText, { color: colors.brandPrimary }]}>
                  Kategorileri kilitle ({parental.lockedCategories.length} kilitli)
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
              </FocusButton>

          <FocusButton
            testID="hide-categories-btn"
            onPress={() => setShowHideModal(true)}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="eye-off" size={22} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>
                Kategorileri gizle ({hiddenGroups.length} gizli)
              </Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>
                Gizlenen kategoriler listede hiç görünmez (PIN ile açılır)
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
          </FocusButton>
              <FocusButton
                testID="hidden-manager-btn"
                onPress={() => router.push(parental.enabled ? "/hidden-pin" : "/hidden-manager")}
                style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <Ionicons name="eye-off" size={18} color={colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Kanal/Film/Dizi Gizleme</Text>
                  <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>Belirli öğeleri tamamen gizle (PIN gerekir)</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
              </FocusButton>
            </>
          )}
          {!parental.enabled && (
            <FocusButton
              testID="hidden-manager-btn"
              onPress={() => router.push("/hidden-manager")}
              style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <Ionicons name="eye-off-outline" size={18} color={colors.onSurfaceSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Kanal/Film/Dizi Gizleme</Text>
                <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>Önce PIN oluşturun</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
            </FocusButton>
          )}
        </View>

        {/* TV'ye Yansıtma */}
        <SectionTitle text="TV'YE YANSITMA" />
        <View style={{ paddingHorizontal: SPACING.lg }}>
          <FocusButton
            testID="chromecast-btn"
            onPress={() => setShowCastModal(true)}
            style={[styles.linkBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="tv" size={18} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Chromecast / AirPlay</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceSecondary }]}>
                Oynatıcıdaki yayınlama simgesinden kullanılır
              </Text>
            </View>
            <View style={[styles.miniTag, { backgroundColor: colors.brandPrimary }]}>
              <Text style={[styles.miniTagText, { color: colors.onBrandPrimary }]}>AKTİF</Text>
            </View>
          </FocusButton>
        </View>

        {/* Oynatma Listeleri */}
        <SectionTitle text="OYNATMA LİSTELERİ" />
        <View style={{ paddingHorizontal: SPACING.lg }}>
          {playlists.map(pl => {
            const active = activePlaylist?.id === pl.id;
            return (
              <View key={pl.id} style={[styles.plCard, { backgroundColor: colors.surfaceSecondary, borderColor: active ? colors.brandPrimary : colors.border }]}>
                <FocusButton testID={`select-playlist-${pl.id}`} style={{ flex: 1 }} onPress={() => setActivePlaylist(pl.id)}>
                  <Text style={[styles.plName, { color: colors.onSurface }]} numberOfLines={1}>{pl.name}</Text>
                  <Text style={[styles.plMeta, { color: colors.onSurfaceSecondary }]} numberOfLines={1}>
                    {pl.source === "xtream" ? "Xtream" : pl.source === "stalker" ? "MAG Portal" : pl.source === "m3u_file" ? "M3U Dosya" : "M3U URL"} • {pl.channels.length} kanal
                  </Text>
                </FocusButton>
                {active && <Ionicons name="radio-button-on" size={20} color={colors.brandPrimary} />}
                <FocusButton testID={`edit-playlist-${pl.id}`} onPress={() => router.push({ pathname: "/edit-playlist", params: { id: pl.id } })} hitSlop={8} style={{ marginLeft: SPACING.sm }}>
                  <Ionicons name="create-outline" size={20} color={colors.onSurface} />
                </FocusButton>
                <FocusButton testID={`delete-playlist-${pl.id}`} onPress={() => removePlaylist(pl.id)} hitSlop={8} style={{ marginLeft: SPACING.sm }}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </FocusButton>
              </View>
            );
          })}
          <FocusButton
            testID="add-new-playlist-btn"
            onPress={() => router.push("/add-playlist")}
            style={[styles.addBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="add" size={20} color={colors.brandPrimary} />
            <Text style={[styles.addBtnText, { color: colors.brandPrimary }]}>Yeni liste ekle</Text>
          </FocusButton>
        </View>

        {/* EPG */}
        <SectionTitle text="EPG (PROGRAM REHBERİ)" />
        <View style={{ paddingHorizontal: SPACING.lg }}>
          <Text style={[styles.hint, { color: colors.onSurfaceSecondary }]}>
            XMLTV URL girin. Aktif liste için kaydedilir. Örnek: https://epgshare01.online/epgshare01/epg_ripper_TR1.xml.gz
          </Text>
          <TextInput
            testID="epg-url-input"
            value={epgInput} onChangeText={setEpgInput}
            editable={!!activePlaylist}
            placeholder="https://.../epg.xml (veya .xml.gz)"
            placeholderTextColor={colors.onSurfaceTertiary}
            autoCapitalize="none" autoCorrect={false}
            style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
          />
          <FocusButton
            testID="fetch-epg-btn" onPress={fetchEpg}
            disabled={!activePlaylist || epgLoading}
            style={[styles.epgBtn, { backgroundColor: colors.brandPrimary, opacity: (!activePlaylist || epgLoading) ? 0.5 : 1 }]}
          >
            {epgLoading ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
              <>
                <Ionicons name="download-outline" size={18} color={colors.onBrandPrimary} />
                <Text style={[styles.epgBtnText, { color: colors.onBrandPrimary }]}>EPG&apos;yi Yükle</Text>
              </>
            )}
          </FocusButton>
          {epgMsg && (
            <Text testID="epg-message" style={[styles.epgMsg, { color: epgMsg.type === "ok" ? colors.success : colors.error }]}>
              {epgMsg.text}
            </Text>
          )}
        </View>

        {/* Hakkında */}
        <SectionTitle text="HAKKINDA" />
        <View style={{ paddingHorizontal: SPACING.lg }}>
          <View style={[styles.aboutCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.aboutTitle, { color: colors.onSurface }]}>KIZILKAN PLAYER</Text>
            <Text style={[styles.aboutVersion, { color: colors.onSurfaceSecondary }]}>Sürüm {Constants.expoConfig?.version ?? "4.4.0"} • Ultimate Edition</Text>
                <Text style={[styles.aboutText, { color: colors.onSurfaceSecondary }]}>
                  Kişisel IPTV player. Yalnızca kendi yasal aboneliğiniz veya kamuya açık kaynaklarla kullanın.
                </Text>
          </View>
        </View>
      </ScrollView>

      {/* PIN Modal */}
      <Modal visible={pinModal !== null} transparent animationType="fade" onRequestClose={() => setPinModal(null)}>
        <Pressable style={styles.modalBg} onPress={() => setPinModal(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
              {pinModal === "create" ? "PIN Oluştur" : "PIN Değiştir"}
            </Text>
            <TextInput
              testID="new-pin-1"
              value={newPin}
              onChangeText={t => setNewPin(t.replace(/\D/g, "").slice(0, 4))}
              placeholder="Yeni PIN (4-10 rakam)"
              placeholderTextColor={colors.onSurfaceTertiary}
              keyboardType="number-pad" secureTextEntry maxLength={10}
              style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
            />
            <TextInput
              testID="new-pin-2"
              value={newPin2}
              onChangeText={t => setNewPin2(t.replace(/\D/g, "").slice(0, 4))}
              placeholder="PIN'i tekrar girin"
              placeholderTextColor={colors.onSurfaceTertiary}
              keyboardType="number-pad" secureTextEntry maxLength={10}
              style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
            />
            {pinErr && <Text style={{ color: colors.error, fontSize: FONT.size.sm, marginTop: 4 }}>{pinErr}</Text>}
            <View style={{ flexDirection: "row", gap: SPACING.md, marginTop: SPACING.lg }}>
              <FocusButton onPress={() => { setPinModal(null); setNewPin(""); setNewPin2(""); setPinErr(null); }} style={[styles.mBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.mBtnText, { color: colors.onSurface }]}>İptal</Text>
              </FocusButton>
              <FocusButton testID="save-pin-btn" onPress={savePin} style={[styles.mBtn, { backgroundColor: colors.brandPrimary }]}>
                <Text style={[styles.mBtnText, { color: colors.onBrandPrimary }]}>Kaydet</Text>
              </FocusButton>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* PROFİL SİLME — YÖNETİCİ PIN MODALI (v6.1.0) */}
      <Modal visible={!!deleteFor} transparent animationType="fade" onRequestClose={() => { setDeleteFor(null); setDelPinInput(""); }}>
        <Pressable style={styles.modalBg} onPress={() => { setDeleteFor(null); setDelPinInput(""); }}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Profili Sil</Text>
            <Text style={[styles.hint, { color: colors.onSurfaceSecondary }]}>
              {profiles.find(x => x.id === deleteFor)?.name} profili ve TÜM listeleri silinecek.
              Onaylamak için yönetici PIN&apos;ini girin.
            </Text>
            <TextInput
              testID="delete-admin-pin"
              value={delPinInput}
              onChangeText={t => { setDelPinInput(t.replace(/\D/g, "").slice(0, 10)); setDelError(null); }}
              placeholder="Yönetici PIN (4-10 rakam)"
              placeholderTextColor={colors.onSurfaceTertiary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={10}
              style={[styles.input, { color: colors.onSurface, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
            />
            {delError && <Text style={{ color: colors.error, marginTop: 6 }}>{delError}</Text>}
            <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }}>
              <FocusButton onPress={() => { setDeleteFor(null); setDelPinInput(""); setDelError(null); }} style={[styles.mBtn, { backgroundColor: colors.surfaceTertiary }]}>
                <Text style={[styles.mBtnText, { color: colors.onSurface }]}>Vazgeç</Text>
              </FocusButton>
              <FocusButton
                testID="delete-confirm-btn"
                onPress={async () => {
                  if (await verifyAdminPin(delPinInput)) {
                    const id = deleteFor!;
                    setDeleteFor(null); setDelPinInput("");
                    await removeProfile(id);
                  } else {
                    setDelError("Yönetici PIN'i yanlış");
                  }
                }}
                disabled={delPinInput.length < 4}
                style={[styles.mBtn, { backgroundColor: colors.error ?? "#D32F2F", opacity: delPinInput.length < 4 ? 0.5 : 1 }]}
              >
                <Text style={[styles.mBtnText, { color: "#fff" }]}>Sil</Text>
              </FocusButton>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* PROFİL PIN MODALI (v5.6.0)
          Kullanıcı isteği: profile sonradan PIN konulabilsin, kaldırılabilsin,
          isterse tekrar konulabilsin. */}
      <Modal visible={!!profilePinFor} transparent animationType="fade" onRequestClose={() => { setProfilePinFor(null); setProfilePinVal(""); }}>
        <Pressable style={styles.modalBg} onPress={() => { setProfilePinFor(null); setProfilePinVal(""); }}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            {(() => {
              const prof = profiles.find(x => x.id === profilePinFor);
              const has = !!prof?.hasPin;
              return (
                <>
                  <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                    {prof?.name} — Profil PIN&apos;i
                  </Text>
                  <Text style={[styles.hint, { color: colors.onSurfaceSecondary }]}>
                    {has
                      ? "Bu profilde PIN var. Yeni PIN girip değiştirebilir veya kaldırabilirsiniz."
                      : "PIN koyarsanız bu profile geçerken PIN sorulur. 4-10 rakam."}
                  </Text>
                  <TextInput
                    testID="profile-pin-input"
                    value={profilePinVal}
                    onChangeText={t => setProfilePinVal(t.replace(/[^0-9]/g, "").slice(0, 10))}
                    placeholder={has ? "Yeni PIN (4-10 rakam)" : "PIN (4-10 rakam)"}
                    placeholderTextColor={colors.onSurfaceTertiary}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={10}
                    style={[styles.input, { color: colors.onSurface, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
                  />
                  <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }}>
                    {has && (
                      <FocusButton
                        testID="profile-pin-remove"
                        onPress={async () => {
                          await setProfPin(profilePinFor!, null);
                          setProfilePinFor(null); setProfilePinVal("");
                          Alert.alert("Tamam", "Profil PIN'i kaldırıldı.");
                        }}
                        style={[styles.mBtn, { backgroundColor: colors.surfaceTertiary }]}
                      >
                        <Text style={[styles.mBtnText, { color: colors.error ?? "#D32F2F" }]}>PIN&apos;i kaldır</Text>
                      </FocusButton>
                    )}
                    <FocusButton
                      testID="profile-pin-save"
                      onPress={async () => {
                        const fmt = isValidPinFormat(profilePinVal);
                        if (!fmt.ok) { Alert.alert("Geçersiz PIN", fmt.error || ""); return; }
                        await setProfPin(profilePinFor!, profilePinVal);
                        const code = await ensureRecoveryCode();
                        setProfilePinFor(null); setProfilePinVal("");
                        Alert.alert(
                          "PIN kaydedildi — Kurtarma Kodunuz",
                          `Bu kodu güvenli bir yere NOT EDİN:\n\n${code}\n\nPIN'inizi unutursanız bu kodla açabilirsiniz.`
                        );
                      }}
                      style={[styles.mBtn, { backgroundColor: colors.brandPrimary }]}
                    >
                      <Text style={[styles.mBtnText, { color: colors.onBrandPrimary }]}>Kaydet</Text>
                    </FocusButton>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* KATEGORİ GİZLEME MODALI (v5.5.0 — daha önce hiç yoktu) */}
      <Modal visible={showHideModal} transparent animationType="fade" onRequestClose={() => setShowHideModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowHideModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: "80%" }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Gizli Kategoriler</Text>
            <Text style={[styles.hint, { color: colors.onSurfaceSecondary, marginBottom: SPACING.md }]}>
              Gizlenen kategoriler listede HİÇ görünmez. Görmek için Gizli İçerikler
              ekranından PIN girmek gerekir.
            </Text>
            <ScrollView>
              {uniqueGroups.map(g => {
                const hidden = isGroupHidden(g);
                return (
                  <FocusButton
                    key={g}
                    testID={`toggle-cat-hide-${g}`}
                    onPress={() => toggleHiddenGroup(g)}
                    style={[styles.lockRow, { borderBottomColor: colors.border }]}
                  >
                    <Ionicons name={hidden ? "eye-off" : "eye-outline"} size={18} color={hidden ? colors.brandPrimary : colors.onSurfaceSecondary} />
                    <Text style={[styles.lockRowText, { color: colors.onSurface }]} numberOfLines={1}>{g}</Text>
                    <Ionicons name={hidden ? "checkbox" : "square-outline"} size={22} color={hidden ? colors.brandPrimary : colors.onSurfaceTertiary} />
                  </FocusButton>
                );
              })}
            </ScrollView>
            <FocusButton
              onPress={() => setShowHideModal(false)}
              style={[styles.mBtn, { backgroundColor: colors.brandPrimary, marginTop: SPACING.md }]}
            >
              <Text style={[styles.mBtnText, { color: colors.onBrandPrimary }]}>Tamam</Text>
            </FocusButton>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Category Lock Modal */}
      <Modal visible={showLockModal} transparent animationType="fade" onRequestClose={() => setShowLockModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowLockModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: "80%" }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Kilitli Kategoriler</Text>
            <Text style={[styles.hint, { color: colors.onSurfaceSecondary, marginBottom: SPACING.md }]}>
              Bu kategorilere PIN olmadan erişilemez. Çocuk profillerinde tamamen gizlenir.
            </Text>
            <ScrollView>
              {uniqueGroups.map(g => {
                const locked = isCategoryLocked(g);
                return (
                  <FocusButton
                    key={g}
                    testID={`toggle-cat-lock-${g}`}
                    onPress={() => toggleCategoryLock(g)}
                    style={[styles.lockRow, { borderBottomColor: colors.border }]}
                  >
                    <Ionicons name={locked ? "lock-closed" : "lock-open-outline"} size={18} color={locked ? colors.brandPrimary : colors.onSurfaceSecondary} />
                    <Text style={[styles.lockRowText, { color: colors.onSurface }]} numberOfLines={1}>{g}</Text>
                    <Ionicons name={locked ? "checkbox" : "square-outline"} size={22} color={locked ? colors.brandPrimary : colors.onSurfaceTertiary} />
                  </FocusButton>
                );
              })}
            </ScrollView>
            <FocusButton onPress={() => setShowLockModal(false)} style={[styles.mBtn, { backgroundColor: colors.brandPrimary, marginTop: SPACING.md }]}>
              <Text style={[styles.mBtnText, { color: colors.onBrandPrimary }]}>Tamam</Text>
            </FocusButton>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Chromecast info modal */}
      <Modal visible={showCastModal} transparent animationType="fade" onRequestClose={() => setShowCastModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowCastModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            <Ionicons name="tv" size={40} color={colors.brandPrimary} style={{ alignSelf: "center", marginBottom: SPACING.md }} />
            <Text style={[styles.modalTitle, { color: colors.onSurface, textAlign: "center" }]}>Chromecast / AirPlay</Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.base, lineHeight: 22, marginTop: SPACING.md, textAlign: "center" }}>
              Chromecast ve AirPlay özelliği, Expo Go üzerinde çalışamayan native modüller gerektirir.
              {"\n\n"}Bu özelliği kullanmak için uygulamayı <Text style={{ color: colors.brandPrimary, fontWeight: FONT.weight.bold }}>Publish</Text> edip iOS/Android build&apos;i almalısınız.
              Build sonrası cast butonu otomatik olarak aktif olacaktır.
            </Text>
            <FocusButton testID="cast-info-ok-btn" onPress={() => setShowCastModal(false)} style={[styles.mBtn, { backgroundColor: colors.brandPrimary, marginTop: SPACING.lg }]}>
              <Text style={[styles.mBtnText, { color: colors.onBrandPrimary }]}>Anladım</Text>
            </FocusButton>
          </Pressable>
        </Pressable>
      </Modal>
      {/* DVR info modal */}
      <Modal visible={showDvrModal} transparent animationType="fade" onRequestClose={() => setShowDvrModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowDvrModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            <Ionicons name="recording" size={40} color={colors.brandPrimary} style={{ alignSelf: "center", marginBottom: SPACING.md }} />
            <Text style={[styles.modalTitle, { color: colors.onSurface, textAlign: "center" }]}>Kayıt Alma (DVR)</Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.base, lineHeight: 22, marginTop: SPACING.md, textAlign: "center" }}>
              Canlı yayın kaydetme, dosya sistemine yazma iznine ve native FFmpeg modülüne ihtiyaç duyar; Expo Go üzerinde çalışamaz.
              {"\n\n"}Bu özelliği kullanmak için <Text style={{ color: colors.brandPrimary, fontWeight: FONT.weight.bold }}>Publish</Text> edip iOS/Android build alın.
              {"\n\n"}Alternatif: Xtream API kaynağınız Catch-up destekliyorsa, geriye dönük programları player&apos;dan izleyebilirsiniz.
            </Text>
            <FocusButton testID="dvr-info-ok-btn" onPress={() => setShowDvrModal(false)} style={[styles.mBtn, { backgroundColor: colors.brandPrimary, marginTop: SPACING.lg }]}>
              <Text style={[styles.mBtnText, { color: colors.onBrandPrimary }]}>Anladım</Text>
            </FocusButton>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Shortcuts info modal */}
      <Modal visible={showShortcutsModal} transparent animationType="fade" onRequestClose={() => setShowShortcutsModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowShortcutsModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            <Ionicons name="apps" size={40} color={colors.brandPrimary} style={{ alignSelf: "center", marginBottom: SPACING.md }} />
            <Text style={[styles.modalTitle, { color: colors.onSurface, textAlign: "center" }]}>Ana Ekran Kısayolları</Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.base, lineHeight: 22, marginTop: SPACING.md, textAlign: "center" }}>
              KIZILKAN PLAYER simgesine uzun bastığınızda 4 hızlı kısayol görürsünüz:
              {"\n\n"}• 🔍 Ara{"\n"}• ❤️ Favoriler{"\n"}• 📅 TV Rehberi{"\n"}• ⚏ Çoklu Ekran
              {"\n\n"}Bu özellik iOS/Android native build gerektirir. Expo Go&apos;da çalışmaz.
              Kod tarafında hazır; <Text style={{ color: colors.brandPrimary, fontWeight: FONT.weight.bold }}>Publish</Text> sonrası aktif olur.
            </Text>
            <FocusButton testID="shortcuts-info-ok-btn" onPress={() => setShowShortcutsModal(false)} style={[styles.mBtn, { backgroundColor: colors.brandPrimary, marginTop: SPACING.lg }]}>
              <Text style={[styles.mBtnText, { color: colors.onBrandPrimary }]}>Anladım</Text>
            </FocusButton>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Notification info modal */}
      <Modal visible={showNotifModal} transparent animationType="fade" onRequestClose={() => setShowNotifModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowNotifModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            <Ionicons name="notifications" size={40} color={colors.brandPrimary} style={{ alignSelf: "center", marginBottom: SPACING.md }} />
            <Text style={[styles.modalTitle, { color: colors.onSurface, textAlign: "center" }]}>Bildirim Paneli Kontrolü</Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.base, lineHeight: 22, marginTop: SPACING.md, textAlign: "center" }}>
              İzlerken uygulamayı arka plana aldığınızda:
              {"\n\n"}📱 Android bildirim panelinde{"\n"}▶️ Oynat/Duraklat{"\n"}⏭ İleri/Geri{"\n"}❌ Kapat{"\n\n"}
              butonları çıkacak. Media session (MediaStyle) native modül gerektirir, Expo Go&apos;da çalışmaz.
              <Text style={{ color: colors.brandPrimary, fontWeight: FONT.weight.bold }}> Publish</Text> sonrası aktif olur.
            </Text>
            <FocusButton testID="notif-info-ok-btn" onPress={() => setShowNotifModal(false)} style={[styles.mBtn, { backgroundColor: colors.brandPrimary, marginTop: SPACING.lg }]}>
              <Text style={[styles.mBtnText, { color: colors.onBrandPrimary }]}>Anladım</Text>
            </FocusButton>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Formats info modal */}
      <Modal visible={showFormatsModal} transparent animationType="fade" onRequestClose={() => setShowFormatsModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowFormatsModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            <Ionicons name="videocam" size={40} color={colors.brandPrimary} style={{ alignSelf: "center", marginBottom: SPACING.md }} />
            <Text style={[styles.modalTitle, { color: colors.onSurface, textAlign: "center" }]}>Desteklenen Formatlar</Text>
            <Text style={{ color: colors.onSurface, fontSize: FONT.size.sm, lineHeight: 22, marginTop: SPACING.md }}>
              <Text style={{ fontWeight: FONT.weight.bold }}>Yerel çalar (ExoPlayer / AVPlayer):</Text>
              {"\n"}✅ MP4, M4V, MOV — H.264, H.265/HEVC
              {"\n"}✅ MKV — H.264/HEVC, AAC/AC3/EAC3, çoklu ses/altyazı
              {"\n"}✅ TS — MPEG-TS (canlı IPTV standart)
              {"\n"}✅ HLS / M3U8 — Apple HTTP Live Streaming
              {"\n"}✅ DASH / MPD — MPEG-DASH
              {"\n"}✅ WebM / VP9
              {"\n"}⚠️ AVI — DivX/Xvid sınırlı
              {"\n"}⚠️ WMV — Windows Media (sınırlı)
              {"\n"}⚠️ FLV — Flash Video (eski)
              {"\n\n"}<Text style={{ fontWeight: FONT.weight.bold }}>Protokol:</Text>
              {"\n"}✅ HTTP — Çoğu IPTV kanalı (usesCleartextTraffic aktif)
              {"\n"}✅ HTTPS — Tüm SSL/TLS kanalları
              {"\n"}✅ Kimlik doğrulama URL&apos;leri (?token=... &authtoken=...)
              {"\n\n"}<Text style={{ fontWeight: FONT.weight.bold }}>Ses/Altyazı:</Text>
              {"\n"}✅ Çoklu ses parçası (Türkçe/İngilizce/Original)
              {"\n"}✅ WebVTT, SRT, ASS altyazı
              {"\n"}✅ SubRip embedded
              {"\n\n"}<Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.xs }}>
                Not: AVI/WMV/FLV formatlarında hata alırsanız sağlayıcınızdan MP4/HLS talep edin. DRM&apos;li (Widevine/FairPlay) içerikler yerel oynatıcıda çalışmaz.
              </Text>
            </Text>
            <FocusButton testID="formats-ok-btn" onPress={() => setShowFormatsModal(false)} style={[styles.mBtn, { backgroundColor: colors.brandPrimary, marginTop: SPACING.lg }]}>
              <Text style={[styles.mBtnText, { color: colors.onBrandPrimary }]}>Anladım</Text>
            </FocusButton>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Siri info modal */}
      <Modal visible={showSiriModal} transparent animationType="fade" onRequestClose={() => setShowSiriModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowSiriModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            <Ionicons name="mic" size={40} color={colors.brandPrimary} style={{ alignSelf: "center", marginBottom: SPACING.md }} />
            <Text style={[styles.modalTitle, { color: colors.onSurface, textAlign: "center" }]}>Siri / Google Assistant</Text>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.base, lineHeight: 22, marginTop: SPACING.md, textAlign: "center" }}>
              &quot;Hey Siri, KIZILKAN&apos;da beIN Sports 1 aç&quot; benzeri komutlar için:
              {"\n\n"}• iOS App Intents (iOS 16+){"\n"}• Android App Actions (Google Assistant){"\n\n"}
              Universal Search entegrasyonu native config ve capability gerektirir.
              <Text style={{ color: colors.brandPrimary, fontWeight: FONT.weight.bold }}> Publish</Text> sonrası App Intent shortcuts otomatik kaydedilir.
            </Text>
            <FocusButton testID="siri-info-ok-btn" onPress={() => setShowSiriModal(false)} style={[styles.mBtn, { backgroundColor: colors.brandPrimary, marginTop: SPACING.lg }]}>
              <Text style={[styles.mBtnText, { color: colors.onBrandPrimary }]}>Anladım</Text>
            </FocusButton>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SectionTitle({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{
      fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 1.5,
      color: colors.onSurfaceTertiary,
      marginTop: SPACING.xl, marginBottom: SPACING.md, paddingHorizontal: SPACING.lg,
    }}>{text}</Text>
  );
}

function AccountInfoCard({ playlist }: { playlist: any }) {
  const { colors } = useTheme();
  const acc = playlist.accountInfo || {};
  const isXtream = playlist.source === "xtream";
  const isStalker = playlist.source === "stalker";

  const formatExpiry = () => {
    if (isXtream && acc.exp_date) {
      const ts = Number(acc.exp_date);
      if (!Number.isFinite(ts) || ts <= 0) return "Süresiz";
      return new Date(ts * 1000).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
    }
    if (isStalker && acc.tariff_expired_date) return String(acc.tariff_expired_date);
    return "—";
  };

  const daysLeft = () => {
    if (isXtream && acc.exp_date) {
      const ts = Number(acc.exp_date);
      if (!Number.isFinite(ts) || ts <= 0) return null;
      const diff = ts * 1000 - Date.now();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
    return null;
  };

  const d = daysLeft();
  const isActive = (acc.status || "").toLowerCase() === "active" || d === null || (d !== null && d > 0);

  return (
    <View style={[cardStyles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="account-info-card">
      <View style={cardStyles.headRow}>
        <View style={[cardStyles.statusDot, { backgroundColor: isActive ? colors.success : colors.error }]} />
        <Text style={[cardStyles.status, { color: isActive ? colors.success : colors.error }]}>
          {isActive ? "AKTİF" : "SÜRESİ DOLDU"}
        </Text>
        {acc.is_trial === "1" && (
          <View style={[cardStyles.trialBadge, { backgroundColor: colors.brandPrimary }]}>
            <Text style={[cardStyles.trialText, { color: colors.onBrandPrimary }]}>DENEME</Text>
          </View>
        )}
      </View>
      <View style={cardStyles.grid}>
        <InfoField label="Kullanıcı" value={acc.username || acc.mac || "—"} />
        <InfoField label="Bitiş Tarihi" value={formatExpiry()} />
        {d !== null && (
          <InfoField label="Kalan Gün" value={d > 0 ? `${d} gün` : "Süresi doldu"} accent={d > 0 && d < 15 ? "warning" : "normal"} />
        )}
        {isXtream && (
          <>
            <InfoField label="Max Kullanıcı" value={String(acc.max_connections || "—")} />
            <InfoField label="Aktif Bağlantı" value={String(acc.active_cons || "0")} />
          </>
        )}
        {isStalker && (
          <>
            {acc.tariff_plan ? <InfoField label="Paket" value={String(acc.tariff_plan)} /> : null}
            {acc.mac ? <InfoField label="MAC" value={String(acc.mac)} /> : null}
            {acc.phone ? <InfoField label="Telefon" value={String(acc.phone)} /> : null}
          </>
        )}
      </View>

      {/* SUNUCU BİLGİLERİ (kullanıcı isteği: görünür olsun) */}
      {isXtream && playlist.serverInfo ? (
        <View style={[cardStyles.serverBox, { borderTopColor: colors.border }]}>
          <Text style={[cardStyles.serverTitle, { color: colors.onSurfaceTertiary }]}>SUNUCU BİLGİLERİ</Text>
          <View style={cardStyles.grid}>
            {playlist.serverInfo.url ? <InfoField label="Sunucu" value={String(playlist.serverInfo.url)} /> : null}
            {playlist.serverInfo.port ? <InfoField label="Port" value={String(playlist.serverInfo.port)} /> : null}
            {playlist.serverInfo.https_port ? <InfoField label="HTTPS Port" value={String(playlist.serverInfo.https_port)} /> : null}
            {playlist.serverInfo.server_protocol ? <InfoField label="Protokol" value={String(playlist.serverInfo.server_protocol)} /> : null}
            {playlist.serverInfo.timezone ? <InfoField label="Saat Dilimi" value={String(playlist.serverInfo.timezone)} /> : null}
            {playlist.serverInfo.version ? <InfoField label="Sürüm" value={String(playlist.serverInfo.version)} /> : null}
          </View>
        </View>
      ) : null}

      {/* DESTEKLENEN YAYIN FORMATLARI (sunucudan — Xtream standardı) */}
      {isXtream && Array.isArray(acc.allowed_output_formats) && acc.allowed_output_formats.length > 0 ? (
        <View style={[cardStyles.serverBox, { borderTopColor: colors.border }]}>
          <Text style={[cardStyles.serverTitle, { color: colors.onSurfaceTertiary }]}>
            DESTEKLENEN YAYIN FORMATLARI
          </Text>
          <Text style={{ color: colors.onSurface, fontSize: FONT.size.sm }}>
            {acc.allowed_output_formats.join(" • ").toUpperCase()}
          </Text>
        </View>
      ) : null}

      {/* PANEL MESAJI (sunucudan — duyuru alanı) */}
      {acc.message ? (
        <View style={[cardStyles.serverBox, { borderTopColor: colors.border }]}>
          <Text style={[cardStyles.serverTitle, { color: colors.onSurfaceTertiary }]}>
            PANEL MESAJI / DUYURU
          </Text>
          <Text style={{ color: colors.onSurface, fontSize: FONT.size.sm, lineHeight: 19 }}>
            {String(acc.message)}
          </Text>
        </View>
      ) : null}

      {/* PANELİN GÖNDERDİĞİ DİĞER ALANLAR
          Bazı paneller APK linki, destek bağlantısı gibi ÖZEL alanlar gönderir.
          Standart olmadıkları için hepsini olduğu gibi listeliyoruz. */}
      {acc.extra && Object.keys(acc.extra).length > 0 ? (
        <View style={[cardStyles.serverBox, { borderTopColor: colors.border }]}>
          <Text style={[cardStyles.serverTitle, { color: colors.onSurfaceTertiary }]}>
            SAĞLAYICININ GÖNDERDİĞİ EK BİLGİLER
          </Text>
          <View style={cardStyles.grid}>
            {Object.entries(acc.extra).slice(0, 12).map(([k, v]) => (
              <InfoField key={k} label={k} value={String(v)} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function InfoField({ label, value, accent }: { label: string; value: string; accent?: "normal" | "warning" }) {
  const { colors } = useTheme();
  const color = accent === "warning" ? colors.error : colors.onSurface;
  return (
    <View style={cardStyles.field}>
      <Text style={[cardStyles.fieldLabel, { color: colors.onSurfaceTertiary }]}>{label}</Text>
      <Text style={[cardStyles.fieldValue, { color }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1 },
  headRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.md },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  status: { fontSize: FONT.size.sm, fontWeight: FONT.weight.black, letterSpacing: 1.5 },
  trialBadge: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm },
  trialText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.black, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
  serverBox: { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1 },
  serverTitle: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 1, marginBottom: SPACING.sm },
  field: { minWidth: "45%", flexGrow: 1 },
  fieldLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 1, marginBottom: 2 },
  fieldValue: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  title: { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, flex: 1 },
  profileBadge: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.pill },
  profileBadgeText: { color: "#fff", fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: SPACING.lg, gap: SPACING.md },
  themeCard: { width: "47.5%", aspectRatio: 1.4, borderRadius: RADIUS.md, borderWidth: 2, padding: SPACING.md, justifyContent: "space-between" },
  themeSwatch: { width: 40, height: 40, borderRadius: RADIUS.pill },
  themeName: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  themeCheck: { position: "absolute", top: 8, right: 8 },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, marginBottom: SPACING.sm,
  },
  pAvatar: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  pAvatarText: { color: "#fff", fontSize: FONT.size.lg, fontWeight: FONT.weight.black },
  pName: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  pMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  miniTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  miniTagText: { color: "#fff", fontSize: 9, fontWeight: FONT.weight.black, letterSpacing: 1 },
  pAction: { padding: SPACING.xs },
  linkBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    height: 52, borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: SPACING.lg,
  },
  linkText: { flex: 1, fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
  rowCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1,
  },
  rowTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  rowSub: { fontSize: FONT.size.sm, marginTop: 2 },
  smallBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  smallBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  plCard: { flexDirection: "row", alignItems: "center", padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, marginBottom: SPACING.sm },
  plName: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
  plMeta: { fontSize: FONT.size.sm, marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 48, borderRadius: RADIUS.md, borderWidth: 1.5, borderStyle: "dashed",
  },
  addBtnText: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  hint: { fontSize: FONT.size.sm, marginBottom: SPACING.md, lineHeight: 18 },
  input: { height: 48, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, fontSize: FONT.size.base, marginBottom: SPACING.md },
  epgBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, height: 48, borderRadius: RADIUS.pill },
  epgBtnText: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  epgMsg: { marginTop: SPACING.sm, fontSize: FONT.size.sm },
  aboutCard: { padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1 },
  aboutTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.black, letterSpacing: 1 },
  aboutVersion: { fontSize: FONT.size.sm, marginTop: 2, marginBottom: SPACING.sm },
  aboutText: { fontSize: FONT.size.sm, lineHeight: 18 },
  // Modals
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  modalCard: { width: "100%", maxWidth: 400, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, gap: SPACING.sm },
  modalTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, marginBottom: SPACING.md },
  modalInput: { height: 52, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, fontSize: FONT.size.lg },
  mBtn: { flex: 1, height: 48, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
  mBtnText: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  lockRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1 },
  lockRowText: { flex: 1, fontSize: FONT.size.base },
});
