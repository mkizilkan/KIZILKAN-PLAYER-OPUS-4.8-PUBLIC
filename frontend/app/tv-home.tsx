/**
 * KIZILKAN PLAYER — TV Sütunlu Ana Ekran (TiviMate Premium düzeni)
 * Dosya  : frontend/app/tv-home.tsx
 * Sürüm  : v2.0.0 (v9.5.0)
 *
 * ===========================================================================
 * DÜZEN (TiviMate Premium referansı)
 * ===========================================================================
 *   ┌────────┬──────────────────┬──────────────────────────────────────────┐
 *   │ LOGO   │ Oynatma listeleri│  [ÖNİZLEME]          Program bilgisi     │
 *   │ 🔍 Ara │ + kategoriler    ├──────────────────────────────────────────┤
 *   │ ▌📺 TV │                  │ # Logo Kanal    │ Şimdi      │ Sıradaki │
 *   │ 🎬 Film│                  │ 1 … MedyaHaber  │ Bilgi yok  │ Bilgi yok│
 *   │ ▶ Dizi │                  │ 2 … Nûçe TV     │ …          │ …        │
 *   │ ⏺ Kayıt│                  │ …               │            │          │
 *   │ 📑 Liste                  │                 │            │          │
 *   │ ⚙ Ayar │                  │                 │            │          │
 *   ├────────┴──────────────────┴──────────────────────────────────────────┤
 *   │ ☰ Kategoriye geç  INFO Detay  🔴 Kayıt  🟢 Hatırlatıcı  🟡 Kanala geç│
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * Klasik arayüze dokunulmaz. Ayarlar > TV Arayüzü > "Sütunlu" ile açılır.
 * Telefon bu ekranı kullanmaz.
 * ===========================================================================
 */

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  BackHandler,
  useWindowDimensions,
  Alert,
  findNodeHandle,
  // @ts-ignore TVFocusGuideView — react-native-tvos
  TVFocusGuideView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { SPACING, FONT } from "@/src/theme/themes";
import { usePlaylists } from "@/src/store/PlaylistContext";
import { useTv } from "@/src/store/TvContext";
import { useParental } from "@/src/store/ParentalContext";
import { FocusButton } from "@/src/components/FocusButton";
import { useTVFocus, rowFocusStyle } from "@/src/hooks/useTVFocus";
import { useFocusScroll } from "@/src/hooks/useFocusScroll";
import { useRemoteKeys } from "@/src/hooks/useRemoteKeys";
import { haptic } from "@/src/utils/haptic";

const ALL = "__ALL__";
const FAV = "__FAV__";
/** Sabit satır yüksekliği — kanal + EPG aynı satırda, getItemLayout ile uyumlu. */
const ROW_H = 48;
const SIDE_ROW_H = 44;
const RAIL_W = 88;

type Tab = "live" | "vod" | "series";
type NavKey = "search" | "live" | "vod" | "series" | "downloads" | "favorites" | "settings";

type SideItem =
  | { kind: "playlist"; id: string; name: string; open: boolean; count: number }
  | { kind: "category"; name: string; count: number; playlistId: string };

export default function TvHomeScreen() {
  return <TvHomeContent />;
}

/**
 * (tabs)/index.tsx içinden koşullu çağrılır:
 *   isTv && tvLayout === "columns" → <TvHomeContent />
 */
export function TvHomeContent() {
  const router = useRouter();
  const { colors } = useTheme();
  const { tvPreview } = useTv();
  const { isCategoryLocked, isUnlockedInSession } = useParental();
  const { width: screenW } = useWindowDimensions();

  const {
    playlists, activePlaylist, setActivePlaylist, isLoading,
    favorites, isFavorite, addToRecent,
  } = usePlaylists();

  const [tab, setTab] = useState<Tab>("live");
  const [selectedCat, setSelectedCat] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [highlighted, setHighlighted] = useState<any>(null);
  const [openPlaylists, setOpenPlaylists] = useState<Record<string, boolean>>({});
  const [epgMap, setEpgMap] = useState<Record<string, any>>({});
  /** v9.8.0: EPG gün kaydırma (0=bugün, 1=yarın …) */
  const [dayOffset, setDayOffset] = useState(0);
  const [progMap, setProgMap] = useState<Record<string, any[]>>({});
  /** Odak hangi sütunda: rail | side | main */
  const [focusZone, setFocusZone] = useState<"rail" | "side" | "main">("main");

  const sideScroll = useFocusScroll<SideItem>();
  const chanScroll = useFocusScroll<any>();
  const searchRef = useRef<TextInput>(null);
  const sideAnchorRef = useRef<any>(null);
  const mainAnchorRef = useRef<any>(null);
  const [sideNode, setSideNode] = useState<number | null>(null);
  const [mainNode, setMainNode] = useState<number | null>(null);

  const multiPlaylist = playlists.length > 1;
  const tooNarrow = screenW < 800;

  const baseList = useMemo(() => {
    if (!activePlaylist) return [] as any[];
    if (tab === "vod") return (activePlaylist.vod || []) as any[];
    if (tab === "series") return (activePlaylist.series || []) as any[];
    return (activePlaylist.channels || []) as any[];
  }, [activePlaylist, tab]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of baseList) {
      const g = it.group || "Diğer";
      counts.set(g, (counts.get(g) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "tr"))
      .map(([name, count]) => ({ name, count }));
  }, [baseList]);

  const sideItems = useMemo<SideItem[]>(() => {
    const favCount = baseList.filter(x => (favorites || []).includes(x.id)).length;
    const head: SideItem[] = [
      { kind: "category", name: FAV, count: favCount, playlistId: activePlaylist?.id || "" },
      { kind: "category", name: ALL, count: baseList.length, playlistId: activePlaylist?.id || "" },
    ];

    if (!multiPlaylist) {
      return [
        ...head,
        ...categories.map(c => ({
          kind: "category" as const,
          name: c.name,
          count: c.count,
          playlistId: activePlaylist?.id || "",
        })),
      ];
    }

    const out: SideItem[] = [];
    for (const pl of playlists) {
      const isActive = pl.id === activePlaylist?.id;
      const open = !!openPlaylists[pl.id] || isActive;
      out.push({
        kind: "playlist",
        id: pl.id,
        name: pl.name,
        open,
        count: pl.channelCount ?? (pl.channels?.length || 0),
      });
      if (open && isActive) {
        out.push(...head);
        out.push(
          ...categories.map(c => ({
            kind: "category" as const,
            name: c.name,
            count: c.count,
            playlistId: pl.id,
          }))
        );
      }
    }
    return out;
  }, [multiPlaylist, categories, baseList, favorites, playlists, activePlaylist?.id, openPlaylists]);

  const channels = useMemo(() => {
    let list = baseList;
    if (selectedCat === FAV) list = list.filter(x => (favorites || []).includes(x.id));
    else if (selectedCat !== ALL) list = list.filter(x => (x.group || "Diğer") === selectedCat);
    // v9.8.0: kilitli kategoriler (oturumda açılmamışsa gizle)
    list = list.filter((x) => {
      const g = x.group || "Diğer";
      if (!isCategoryLocked(g)) return true;
      return isUnlockedInSession(g);
    });
    const q = search.trim().toLocaleLowerCase("tr");
    if (q) list = list.filter(x => String(x.name || "").toLocaleLowerCase("tr").includes(q));
    return list;
  }, [baseList, selectedCat, favorites, search, isCategoryLocked, isUnlockedInSession]);

  const openItem = useCallback((item: any) => {
    haptic.light();
    if (tab === "live") {
      addToRecent(item.id);
      router.push({ pathname: "/player", params: { id: item.id } });
    } else {
      router.push({ pathname: "/detail", params: { type: tab, id: item.id } });
    }
  }, [tab, addToRecent, router]);

  // Odak köprü node id'lerini güncelle (sol sütun ↔ kanal listesi)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        if (sideAnchorRef.current) setSideNode(findNodeHandle(sideAnchorRef.current) as number | null);
        if (mainAnchorRef.current) setMainNode(findNodeHandle(mainAnchorRef.current) as number | null);
      } catch { /* yoksay */ }
    });
    return () => cancelAnimationFrame(id);
  }, [tab, selectedCat, channels.length, sideItems.length]);

  const stepChannel = useCallback((delta: 1 | -1) => {
    if (channels.length === 0) return;
    const cur = highlighted ? channels.findIndex(c => c.id === highlighted.id) : -1;
    const next = (cur + delta + channels.length) % channels.length;
    const target = channels[next];
    if (!target) return;
    haptic.soft();
    setHighlighted(target);
    chanScroll.onItemFocus(next);
  }, [channels, highlighted, chanScroll]);

  const onNav = useCallback((key: NavKey) => {
    haptic.soft();
    setFocusZone("rail");
    switch (key) {
      case "search":
        setShowSearch(true);
        setTimeout(() => searchRef.current?.focus(), 80);
        break;
      case "live":
        setTab("live"); setSelectedCat(ALL); setHighlighted(null); setShowSearch(false);
        break;
      case "vod":
        setTab("vod"); setSelectedCat(ALL); setHighlighted(null); setShowSearch(false);
        break;
      case "series":
        setTab("series"); setSelectedCat(ALL); setHighlighted(null); setShowSearch(false);
        break;
      case "downloads":
        router.push("/downloads");
        break;
      case "favorites":
        setTab("live"); setSelectedCat(FAV); setHighlighted(null); setShowSearch(false);
        break;
      case "settings":
        router.push("/(tabs)/settings");
        break;
    }
  }, [router]);

  useRemoteKeys({
    channelUp: () => stepChannel(1),
    channelDown: () => stepChannel(-1),
    play: () => { if (highlighted) openItem(highlighted); },
    playPause: () => { if (highlighted) openItem(highlighted); },
    guide: () => router.push("/epg-timeline"),
    info: () => { if (highlighted && tab !== "live") openItem(highlighted); },
    /**
     * v9.6.0 — SOL tuşu: ana listeden sol sütuna (kategori) geç.
     * FlatList varsayılan trapFocusLeft sol sütunu engelliyordu (#7).
     */
    dpadLeft: () => {
      try {
        const n = sideAnchorRef.current;
        if (n && typeof n.requestTVFocus === "function") {
          n.requestTVFocus();
          setFocusZone("side");
          haptic.soft();
        }
      } catch { /* yoksay */ }
    },
    dpadRight: () => {
      try {
        const n = mainAnchorRef.current;
        if (n && typeof n.requestTVFocus === "function") {
          n.requestTVFocus();
          setFocusZone("main");
          haptic.soft();
        }
      } catch { /* yoksay */ }
    },
    backLongPress: () => {
      haptic.medium();
      setSearch("");
      setShowSearch(false);
      setSelectedCat(ALL);
    },
  });

  // EPG yükleme (canlı sekme)
  useEffect(() => {
    if (tab !== "live" || !activePlaylist?.id) return;
    let alive = true;
    (async () => {
      try {
        const ids = channels
          .slice(0, 80)
          .map((c: any) => c.epg_channel_id || c.tvg_id)
          .filter(Boolean) as string[];
        if (ids.length === 0) return;
        const { getNowNext, getProgramsInRange } = await import("@/src/utils/epg");
        const res = await getNowNext(activePlaylist.id, ids, (activePlaylist as any).epgUrl);
        if (alive && res?.data) setEpgMap(res.data);
        // Tam gün aralığı (yerel gün + dayOffset)
        const day0 = new Date();
        day0.setHours(0, 0, 0, 0);
        day0.setDate(day0.getDate() + dayOffset);
        const startSec = Math.floor(day0.getTime() / 1000);
        const stopSec = startSec + 86400;
        try {
          const range = await getProgramsInRange(
            activePlaylist.id, ids, startSec, stopSec, (activePlaylist as any).epgUrl
          );
          if (alive) setProgMap(range || {});
        } catch { if (alive) setProgMap({}); }
      } catch { /* EPG yoksa hücreler "Bilgi yok" kalır */ }
    })();
    return () => { alive = false; };
  }, [tab, activePlaylist?.id, selectedCat, channels.length, dayOffset]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showSearch || search.trim()) {
        setSearch("");
        setShowSearch(false);
        return true;
      }
      if (selectedCat !== ALL) { setSelectedCat(ALL); return true; }
      return false;
    });
    return () => sub.remove();
  }, [search, selectedCat, showSearch]);

  const epgFor = useCallback((item: any) => {
    const key = item?.epg_channel_id || item?.tvg_id || "";
    return key ? (epgMap as any)[key] : null;
  }, [epgMap]);

  const catLabel = (name: string) =>
    name === ALL ? "Tüm kanallar" : name === FAV ? "Favoriler" : name;

  const hlEpg = highlighted ? epgFor(highlighted) : null;
  const nowTitle = hlEpg?.now?.title || "Bilgi yok";
  const nowRange = (() => {
    const s = hlEpg?.now?.start;
    const e = hlEpg?.now?.stop;
    if (!s || !e) return "";
    try {
      const fmt = (d: Date) =>
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      return `${fmt(new Date(s))} – ${fmt(new Date(e))}`;
    } catch { return ""; }
  })();
  const nowPct = (() => {
    const s = hlEpg?.now?.start;
    const e = hlEpg?.now?.stop;
    if (!s || !e) return 0;
    try {
      const a = new Date(s).getTime();
      const b = new Date(e).getTime();
      const n = Date.now();
      if (n <= a) return 0;
      if (n >= b) return 1;
      return (n - a) / (b - a);
    } catch { return 0; }
  })();

  /**
   * v9.7.0 — 4 dilimli EPG ızgarası (TiviMate benzeri)
   * 30 dk dilimler: şimdi hizasından itibaren 2 saat.
   */
  /**
   * v9.8.0 — 8 × 30 dk görünür pencere (4 saat).
   * dayOffset=0: şu andan itibaren; diğer günler: gün 00:00'dan.
   * "Sonraki gün" ile kaydırılır.
   */
  const epgSlots = useMemo(() => {
    const fmt = (d: Date) =>
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    let t0: Date;
    if (dayOffset === 0) {
      const now = new Date();
      const m = now.getMinutes() < 30 ? 0 : 30;
      t0 = new Date(now);
      t0.setMinutes(m, 0, 0);
    } else {
      t0 = new Date();
      t0.setHours(0, 0, 0, 0);
      t0.setDate(t0.getDate() + dayOffset);
    }
    const slots: { label: string; startMs: number; endMs: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const start = new Date(t0.getTime() + i * 30 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      slots.push({ label: fmt(start), startMs: start.getTime(), endMs: end.getTime() });
    }
    return slots;
  }, [dayOffset]);

  if (tooNarrow) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: SPACING.xl }]}>
        <Ionicons name="phone-landscape" size={54} color={colors.brandPrimary} />
        <Text style={{ color: colors.onSurface, fontSize: FONT.size.lg, fontWeight: "800", marginTop: SPACING.md, textAlign: "center" }}>
          Sütunlu düzen geniş ekran ister
        </Text>
        <Text style={{ color: colors.onSurfaceSecondary, textAlign: "center", marginTop: SPACING.sm, lineHeight: 20 }}>
          Cihazı YATAY çevirin veya Ayarlar → TV Arayüzü → "Klasik" seçin.
        </Text>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </SafeAreaView>
    );
  }

  const navItems: { key: NavKey; icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean }[] = [
    { key: "search", icon: "search", label: "Arama" },
    { key: "live", icon: "tv-outline", label: "TV", active: tab === "live" && selectedCat !== FAV && !showSearch },
    { key: "vod", icon: "film-outline", label: "Filmler", active: tab === "vod" },
    { key: "series", icon: "albums-outline", label: "Diziler", active: tab === "series" },
    { key: "downloads", icon: "download-outline", label: "Kayıtlar" },
    { key: "favorites", icon: "bookmark-outline", label: "Listem", active: selectedCat === FAV },
    { key: "settings", icon: "settings-outline", label: "Ayarlar" },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: "#0B0E14" }]} testID="tv-home" edges={["top", "left", "right"]}>
      <View style={styles.body}>
        {/* ══ SOL MENÜ RAYI ══ */}
        <View style={[styles.rail, { backgroundColor: "#0A0D12", borderRightColor: "#1A2030" }]}>
          <View style={styles.railLogo}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={{ width: 36, height: 36, borderRadius: 8 }}
              resizeMode="contain"
            />
            <Text style={styles.railBrand} numberOfLines={1}>KIZILKAN</Text>
          </View>

          <View style={styles.railNav}>
            {navItems.map((it, idx) => (
              <FocusButton
                key={it.key}
                testID={`tvh-nav-${it.key}`}
                autoFocus={it.key === "live"}
                onPress={() => onNav(it.key)}
                onFocus={() => setFocusZone("rail")}
                focusRadius={10}
                style={[
                  styles.railItem,
                  it.active && { backgroundColor: "#FFFFFF", borderRadius: 10 },
                ]}
              >
                <Ionicons
                  name={it.icon}
                  size={22}
                  color={it.active ? "#0B0E14" : "#9AA3B2"}
                />
                <Text
                  style={[
                    styles.railLabel,
                    { color: it.active ? "#0B0E14" : "#9AA3B2" },
                  ]}
                  numberOfLines={1}
                >
                  {it.label}
                </Text>
              </FocusButton>
            ))}
          </View>
        </View>

        {/* ══ 2. SÜTUN: LİSTELER + KATEGORİLER ══ */}
        <TVFocusGuideView style={[styles.sideCol, { borderRightColor: "#1A2030" }]} autoFocus={false}>
          {showSearch ? (
            <View style={[styles.searchBox, { backgroundColor: "#141A24", borderColor: "#2A3344" }]}>
              <Ionicons name="search" size={16} color="#9AA3B2" />
              <TextInput
                ref={searchRef}
                testID="tvh-search"
                value={search}
                onChangeText={setSearch}
                placeholder="Kanal ara…"
                placeholderTextColor="#6B7380"
                style={{ flex: 1, color: "#EEF2F8", paddingVertical: 8, fontSize: 14 }}
                onBlur={() => { if (!search.trim()) setShowSearch(false); }}
              />
            </View>
          ) : (
            <Text style={styles.sideHeader}>Oynatma listeleri</Text>
          )}

          {/* Odak köprüsü: dpadLeft / nextFocusLeft buraya gelir */}
          <FocusButton
            ref={sideAnchorRef as any}
            testID="tvh-side-anchor"
            onPress={() => {}}
            onFocus={() => setFocusZone("side")}
            focusRadius={0}
            style={{ height: 1, width: 1, opacity: 0.01 }}
          />

          <FlatList
            ref={sideScroll.listRef}
            data={sideItems}
            keyExtractor={(it, i) => (it.kind === "playlist" ? `p-${it.id}` : `c-${it.name}-${i}`)}
            onScrollToIndexFailed={sideScroll.onScrollToIndexFailed}
            initialNumToRender={16}
            windowSize={7}
            removeClippedSubviews={false}
            // @ts-ignore TV: sol/sağ tuzaktan çıkışa izin ver
            renderItem={({ item, index }) => (
              <SideRow
                item={item}
                label={item.kind === "playlist" ? item.name : catLabel(item.name)}
                selected={item.kind === "category" && item.name === selectedCat}
                nextFocusRight={mainNode}
                isFirst={index === 0}
                onFocusItem={() => {
                  sideScroll.onItemFocus(index);
                  setFocusZone("side");
                }}
                onPress={async () => {
                  if (item.kind === "playlist") {
                    if (item.id !== activePlaylist?.id) await setActivePlaylist(item.id);
                    setOpenPlaylists(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                    setSelectedCat(ALL);
                  } else {
                    setSelectedCat(item.name);
                  }
                  haptic.soft();
                }}
              />
            )}
          />
        </TVFocusGuideView>

        {/* ══ ANA ALAN: ÖNİZLEME + KANAL/EPG ══ */}
        <View style={styles.mainCol}>
          {/* Üst bant: önizleme + program bilgisi */}
          <View style={styles.previewBand}>
            {tvPreview && (
              <View style={styles.previewBox}>
                {highlighted?.logo || highlighted?.poster ? (
                  <Image
                    source={{ uri: highlighted.logo || highlighted.poster }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.previewInner}>
                    <Ionicons name="tv-outline" size={36} color="#4A5568" />
                  </View>
                )}
              </View>
            )}
            <View style={styles.previewInfo}>
              <Text style={styles.previewTitle} numberOfLines={2}>
                {highlighted ? nowTitle : "Kanal seçin"}
              </Text>
              {!!nowRange && (
                <View style={styles.previewMeta}>
                  <Text style={styles.previewTime}>{nowRange}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(nowPct * 100)}%` }]} />
                  </View>
                </View>
              )}
              {highlighted ? (
                <Text style={styles.previewChan} numberOfLines={1}>
                  {highlighted.name}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Zaman başlıkları (canlı) */}
          {tab === "live" && (
            <View style={styles.timeHeaderRow}>
              <View style={styles.chanHeadSlot}>
                <Text style={styles.timeHeadText}>
                  {(() => {
                    const d = new Date();
                    d.setDate(d.getDate() + dayOffset);
                    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "short" });
                  })()}
                </Text>
              </View>
              {epgSlots.map((sl) => (
                <View key={sl.label} style={styles.epgHeadSlot}>
                  <Text style={styles.timeHeadText}>{sl.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Kanal listesi + EPG (TEK FlatList — senkron kaydırma) */}
          {tab !== "live" ? (
            <FlatList
              data={channels}
              keyExtractor={(it: any) => String(it.id)}
              numColumns={5}
              key="vodgrid"
              initialNumToRender={15}
              windowSize={5}
              removeClippedSubviews={false}
              contentContainerStyle={{ padding: 8 }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {search ? "Sonuç yok" : "Bu kategoride içerik yok"}
                </Text>
              }
              renderItem={({ item }) => (
                <FocusButton
                  testID={`tvh-vod-${item.id}`}
                  onPress={() => openItem(item)}
                  onFocus={() => setHighlighted((p: any) => (p?.id === item.id ? p : item))}
                  focusRadius={8}
                  style={styles.vodCard}
                >
                  <View style={styles.vodPoster}>
                    {item.poster ? (
                      <Image source={{ uri: item.poster }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <View style={styles.previewInner}>
                        <Ionicons name="film-outline" size={22} color="#4A5568" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.vodTitle} numberOfLines={2}>{item.name}</Text>
                </FocusButton>
              )}
            />
          ) : (
            <FlatList
              ref={chanScroll.listRef}
              data={channels}
              keyExtractor={(it: any) => String(it.id)}
              onScrollToIndexFailed={chanScroll.onScrollToIndexFailed}
              getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
              initialNumToRender={16}
              windowSize={9}
              removeClippedSubviews={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {search ? "Sonuç yok" : "Bu kategoride içerik yok"}
                </Text>
              }
              renderItem={({ item, index }) => {
                const e = epgFor(item);
                const fav = isFavorite(item.id);
                return (
                  <ChanEpgRow
                    index={index}
                    item={item}
                    fav={fav}
                    epg={e}
                    programs={progMap[String(item.epg_channel_id || item.tvg_id || item.stream_id || item.id)] || []}
                    slots={epgSlots}
                    nextFocusLeft={sideNode}
                    isAnchor={index === 0}
                    anchorRef={index === 0 ? mainAnchorRef : undefined}
                    onFocusItem={() => {
                      chanScroll.onItemFocus(index);
                      setFocusZone("main");
                      setHighlighted((prev: any) => (prev?.id === item.id ? prev : item));
                    }}
                    onPress={() => openItem(item)}
                  />
                );
              }}
            />
          )}
        </View>
      </View>

      {/* ══ ALT KUMANDA İPUCU ÇUBUĞU ══ */}
      <View style={[styles.hintBar, { borderTopColor: "#1A2030" }]}>
        <Hint
          icon="menu"
          label="Kategoriye geç"
          color="#EEF2F8"
          onPress={() => {
            try {
              const n = sideAnchorRef.current;
              if (n?.requestTVFocus) n.requestTVFocus();
              setFocusZone("side");
            } catch {}
          }}
        />
        <Hint
          icon="information-circle-outline"
          label="Detay"
          color="#EEF2F8"
          onPress={() => {
            if (highlighted && tab !== "live") openItem(highlighted);
            else if (highlighted) {
              // Canlıda EPG detay: program adı
              const e = epgFor(highlighted);
              const t = e?.now?.title || e?.next?.title || highlighted.name;
              Alert.alert(highlighted.name, t);
            }
          }}
        />
        <Hint
          dot="#E53935"
          label="Kayıt"
          onPress={() => {
            if (!highlighted || tab !== "live") {
              Alert.alert("Kayıt", "Önce bir canlı kanal seçin.");
              return;
            }
            addToRecent(highlighted.id);
            router.push({ pathname: "/player", params: { id: highlighted.id, autoRecord: "1" } });
          }}
        />
        <Hint
          dot="#43A047"
          label="Hatırlatıcı"
          onPress={async () => {
            if (!highlighted) {
              Alert.alert("Hatırlatıcı", "Önce bir kanal seçin.");
              return;
            }
            const e = epgFor(highlighted);
            const prog = e?.next || e?.now;
            if (!prog?.title) {
              Alert.alert("Hatırlatıcı", "Bu kanal için program bilgisi yok.");
              return;
            }
            try {
              const { addReminder } = await import("@/src/utils/reminders");
              const startTs = prog.start_timestamp || Math.floor(Date.now() / 1000) + 3600;
              await addReminder({
                channelId: String(highlighted.id),
                channelName: String(highlighted.name || ""),
                title: String(prog.title),
                startTs: Number(startTs),
              });
              Alert.alert("Hatırlatıcı eklendi", `${prog.title}\n${highlighted.name}`);
              haptic.success();
            } catch (err: any) {
              Alert.alert("Hatırlatıcı", String(err?.message || err));
            }
          }}
        />
        <Hint
          dot="#F9A825"
          label="Kanala geç"
          onPress={() => {
            if (highlighted && tab === "live") openItem(highlighted);
          }}
        />
        <Hint
          dot="#1E88E5"
          label={dayOffset === 0 ? "Sonraki gün" : dayOffset > 0 ? `+${dayOffset} gün` : `${dayOffset} gün`}
          onPress={() => {
            setDayOffset((d) => (d >= 6 ? 0 : d + 1));
            haptic.soft();
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/* ─── Alt bileşenler ─── */

function SideRow({
  item, label, selected, onPress, onFocusItem, nextFocusRight, isFirst,
}: {
  item: SideItem;
  label: string;
  selected: boolean;
  onPress: () => void;
  onFocusItem: () => void;
  nextFocusRight?: number | null;
  isFirst?: boolean;
}) {
  const { isFocused, onFocus, onBlur } = useTVFocus();
  const isPl = item.kind === "playlist";

  return (
    <FocusButton
      testID={`tvh-side-${label}`}
      onPress={onPress}
      onFocus={() => { onFocus(); onFocusItem(); }}
      onBlur={onBlur}
      focusRadius={8}
      // @ts-ignore nextFocusRight — TV
      {...(nextFocusRight != null ? { nextFocusRight } : {})}
      style={[
        styles.sideRow,
        selected && { backgroundColor: "rgba(227,10,23,0.22)" },
        isFocused && rowFocusStyle("#E30A17", true, 8),
      ]}
    >
      {isPl && (
        <Ionicons
          name={(item as any).open ? "chevron-down" : "chevron-forward"}
          size={14}
          color="#9AA3B2"
        />
      )}
      <Text
        style={[
          styles.sideText,
          {
            color: selected ? "#FF5A5F" : "#EEF2F8",
            fontWeight: isPl ? "800" : selected ? "700" : "500",
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={styles.sideCount}>{item.count}</Text>
    </FocusButton>
  );
}

function titleForSlot(
  epg: any,
  programs: any[] | undefined,
  slot: { startMs: number; endMs: number },
  slotIndex: number,
): string {
  const startSec = Math.floor(slot.startMs / 1000);
  const endSec = Math.floor(slot.endMs / 1000);
  if (programs && programs.length) {
    for (const p of programs) {
      const a = p.start_timestamp ?? 0;
      const b = p.stop_timestamp ?? 0;
      if (a < endSec && b > startSec) return p.title || "Bilgi yok";
    }
  }
  const now = epg?.now;
  const next = epg?.next;
  const parse = (v?: string) => {
    if (!v) return null;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : null;
  };
  const nStart = parse(now?.start);
  const nStop = parse(now?.stop);
  const xStart = parse(next?.start);
  const xStop = parse(next?.stop);
  if (now?.title && nStart != null && nStop != null) {
    if (nStart < slot.endMs && nStop > slot.startMs) return now.title;
  }
  if (next?.title && xStart != null && xStop != null) {
    if (xStart < slot.endMs && xStop > slot.startMs) return next.title;
  }
  if (slotIndex === 0) return now?.title || "Bilgi yok";
  if (slotIndex === 1) return next?.title || "Bilgi yok";
  return "Bilgi yok";
}

function ChanEpgRow({
  index, item, fav, epg, programs, slots, onPress, onFocusItem, nextFocusLeft, isAnchor, anchorRef,
}: {
  index: number;
  item: any;
  fav: boolean;
  epg: any;
  programs?: any[];
  slots: { label: string; startMs: number; endMs: number }[];
  onPress: () => void;
  onFocusItem: () => void;
  nextFocusLeft?: number | null;
  isAnchor?: boolean;
  anchorRef?: React.RefObject<any>;
}) {
  const { isFocused, onFocus, onBlur } = useTVFocus();

  return (
    <FocusButton
      ref={isAnchor ? (anchorRef as any) : undefined}
      testID={`tvh-chan-${item.id}`}
      onPress={onPress}
      onFocus={() => { onFocus(); onFocusItem(); }}
      onBlur={onBlur}
      focusRadius={6}
      // @ts-ignore nextFocusLeft — TV: sol sütuna çık (#7)
      {...(nextFocusLeft != null ? { nextFocusLeft } : {})}
      style={[
        styles.chanRow,
        isFocused && {
          backgroundColor: "rgba(227,10,23,0.18)",
          borderColor: "#E30A17",
          borderWidth: 2,
        },
      ]}
    >
      <View style={styles.chanId}>
        <Text style={styles.chanNum}>{index + 1}</Text>
        <View style={styles.chanLogo}>
          {item.logo || item.poster ? (
            <Image
              source={{ uri: item.logo || item.poster }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          ) : (
            <Ionicons name="tv-outline" size={14} color="#4A5568" />
          )}
        </View>
        <Text style={styles.chanName} numberOfLines={1}>{item.name}</Text>
        {fav ? <Ionicons name="heart" size={12} color="#E30A17" /> : null}
      </View>
      {slots.map((sl, i) => {
        const title = titleForSlot(epg, programs, sl, i);
        return (
          <View key={sl.label} style={[styles.epgCell, i > 0 && styles.epgCellDim]}>
            <Text
              style={[styles.epgText, i > 0 && { color: "#7A8494" }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
        );
      })}
    </FocusButton>
  );
}

function Hint({ icon, label, color, dot, onPress }: { icon?: any; label: string; color?: string; dot?: string; onPress?: () => void }) {
  const inner = (
    <>
      {dot ? (
        <View style={[styles.hintDot, { backgroundColor: dot }]} />
      ) : (
        <Ionicons name={icon} size={14} color={color || "#9AA3B2"} />
      )}
      <Text style={styles.hintLabel}>{label}</Text>
    </>
  );
  if (onPress) {
    return (
      <FocusButton onPress={onPress} focusRadius={6} style={styles.hintItem}>
        {inner}
      </FocusButton>
    );
  }
  return <View style={styles.hintItem}>{inner}</View>;
}

/* ─── Stiller ─── */

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, flexDirection: "row" },

  /* Sol ray */
  rail: {
    width: RAIL_W,
    borderRightWidth: 1,
    paddingTop: 8,
    paddingBottom: 8,
    justifyContent: "flex-start",
  },
  railLogo: {
    alignItems: "center",
    paddingVertical: 10,
    gap: 4,
  },
  railBrand: {
    color: "#E30A17",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  railNav: {
    flex: 1,
    paddingHorizontal: 6,
    gap: 4,
    marginTop: 8,
  },
  railItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 3,
  },
  railLabel: {
    fontSize: 10,
    fontWeight: "600",
  },

  /* 2. sütun */
  sideCol: {
    width: "22%",
    maxWidth: 280,
    minWidth: 180,
    borderRightWidth: 1,
    paddingTop: 8,
  },
  sideHeader: {
    color: "#6B7380",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  sideRow: {
    height: SIDE_ROW_H,
    marginHorizontal: 6,
    marginBottom: 2,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
  },
  sideText: { flex: 1, fontSize: 13 },
  sideCount: { color: "#6B7380", fontSize: 11 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
  },

  /* Ana alan */
  mainCol: { flex: 1 },
  previewBand: {
    flexDirection: "row",
    padding: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A2030",
    minHeight: 110,
  },
  previewBox: {
    width: 200,
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    borderRadius: 6,
    overflow: "hidden",
  },
  previewInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0D12",
  },
  previewInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  previewTitle: {
    color: "#EEF2F8",
    fontSize: 18,
    fontWeight: "800",
  },
  previewMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewTime: {
    color: "#9AA3B2",
    fontSize: 13,
    fontWeight: "600",
  },
  progressTrack: {
    flex: 1,
    maxWidth: 160,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A3344",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#E30A17",
    borderRadius: 2,
  },
  previewChan: {
    color: "#6B7380",
    fontSize: 12,
  },

  timeHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1A2030",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  chanHeadSlot: { width: "20%", paddingHorizontal: 4 },
  epgHeadSlot: { width: "10%", paddingHorizontal: 2 },
  timeHeadText: {
    color: "#6B7380",
    fontSize: 11,
    fontWeight: "700",
  },

  /* Kanal + EPG satırı */
  chanRow: {
    height: ROW_H,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 4,
    marginBottom: 0,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  chanId: {
    width: "20%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  chanNum: {
    color: "#6B7380",
    fontSize: 12,
    fontWeight: "700",
    width: 28,
    textAlign: "right",
  },
  chanLogo: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: "#141A24",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  chanName: {
    flex: 1,
    color: "#EEF2F8",
    fontSize: 13,
    fontWeight: "600",
  },
  epgCell: {
    width: "10%",
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  epgCellDim: {
    opacity: 0.85,
  },
  epgText: {
    color: "#C5CDD8",
    fontSize: 12,
  },

  /* VOD ızgara */
  vodCard: {
    width: "20%",
    padding: 6,
  },
  vodPoster: {
    aspectRatio: 2 / 3,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#141A24",
  },
  vodTitle: {
    color: "#EEF2F8",
    fontSize: 11,
    marginTop: 4,
  },

  emptyText: {
    color: "#6B7380",
    padding: 20,
    textAlign: "center",
  },

  /* Alt ipucu çubuğu */
  hintBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    backgroundColor: "#0A0D12",
  },
  hintItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hintDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  hintLabel: {
    color: "#9AA3B2",
    fontSize: 12,
    fontWeight: "600",
  },
});
