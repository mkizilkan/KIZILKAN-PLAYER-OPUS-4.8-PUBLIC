/**
 * KIZILKAN PLAYER — TV Sütunlu Ana Ekran
 * Dosya  : frontend/app/tv-home.tsx
 * Sürüm  : v1.0.0 (v8.0.0)
 *
 * ===========================================================================
 * NE?
 * ===========================================================================
 * TiviMate / Rike Playzer tarzı ÜÇ SÜTUNLU TV arayüzü:
 *
 *   ┌──────────────┬──────────────────┬─────────────────────┐
 *   │ LİSTELER +   │    KANALLAR      │  ÖNİZLEME + BİLGİ   │
 *   │ KATEGORİLER  │  (+ arama)       │  (canlı görüntü,    │
 *   │              │                  │   EPG, düğmeler)    │
 *   └──────────────┴──────────────────┴─────────────────────┘
 *
 * MEVCUT EKRANA DOKUNULMADI. Ayarlar > TV Arayüzü'nden seçilir;
 * varsayılan "klasik" olduğu için kullanıcı açmadan hiçbir şey değişmez.
 * Telefonda bu ekran hiç kullanılmaz.
 *
 * SOL SÜTUN — AKILLI DAVRANIŞ (kullanıcıyla kararlaştırıldı):
 *   • TEK liste varsa  -> doğrudan kategoriler (gereksiz seviye yok)
 *   • ÇOK liste varsa  -> liste adı, açılınca altında o listenin kategorileri
 * Böylece tek listeli kullanıcı her açılışta fazladan tuşa basmaz; ikinci
 * liste eklenince ağaç kendiliğinden belirir.
 * ===========================================================================
 */

import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { SPACING, RADIUS, FONT } from "@/src/theme/themes";
import { usePlaylists } from "@/src/store/PlaylistContext";
import { useTv } from "@/src/store/TvContext";
import { FocusButton } from "@/src/components/FocusButton";
import { useTVFocus, rowFocusStyle, focusStyle } from "@/src/hooks/useTVFocus";
import { useFocusScroll } from "@/src/hooks/useFocusScroll";
import { useRemoteKeys } from "@/src/hooks/useRemoteKeys";
import { haptic } from "@/src/utils/haptic";

const ALL = "__ALL__";
const FAV = "__FAV__";
const SIDE_ROW_H = 46;
const CHAN_ROW_H = 52;

type Tab = "live" | "vod" | "series";

/** Sol sütun öğesi: ya bir liste başlığı ya da bir kategori. */
type SideItem =
  | { kind: "playlist"; id: string; name: string; open: boolean; count: number }
  | { kind: "category"; name: string; count: number; playlistId: string };

export default function TvHomeScreen() {
  return <TvHomeContent />;
}

/**
 * İçerik ayrı bir bileşen olarak dışa aktarılıyor ki (tabs)/index.tsx
 * içinden DOĞRUDAN çağrılabilsin.
 *
 * NEDEN: Eskiden tv-home'a yalnızca playlist-select üzerinden yönlendirme
 * vardı. Kullanıcı Ayarlar'dan "Sütunlu" seçince sekme çubuğu içinde kaldığı
 * için bu ekrana HİÇ UĞRAMIYORDU -> yeni arayüz asla görünmedi.
 * Koşullu render ile bu sorun kökten çözülüyor.
 */
export function TvHomeContent() {
  const router = useRouter();
  const { colors } = useTheme();
  const { tvPreview } = useTv();
  /**
   * ÇÖKME DÜZELTMESİ (v8.4.0)
   * "Cannot read property 'includes' of undefined"
   * SEBEP: favorites/toggleFavorite/isFavorite/addToRecent LibraryContext'te
   * DEĞİL, PlaylistContext'te bulunuyor. Yanlış context'ten alındığı için
   * favorites UNDEFINED oluyordu ve favorites.includes(...) uygulamayı
   * çökertiyordu. Bu yüzden sütunlu arayüz hiç açılamıyordu.
   */
  const {
    playlists, activePlaylist, setActivePlaylist, isLoading,
    favorites, toggleFavorite, isFavorite, addToRecent,
  } = usePlaylists();

  const [tab, setTab] = useState<Tab>("live");
  const [selectedCat, setSelectedCat] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState<any>(null);
  /** Açık liste düğümleri (çoklu liste modunda). */
  const [openPlaylists, setOpenPlaylists] = useState<Record<string, boolean>>({});

  const sideScroll = useFocusScroll<SideItem>();
  const chanScroll = useFocusScroll<any>();

  const multiPlaylist = playlists.length > 1;

  /** Aktif listedeki, seçili sekmeye ait tüm öğeler. */
  const baseList = useMemo(() => {
    if (!activePlaylist) return [] as any[];
    if (tab === "vod") return (activePlaylist.vod || []) as any[];
    if (tab === "series") return (activePlaylist.series || []) as any[];
    return (activePlaylist.channels || []) as any[];
  }, [activePlaylist, tab]);

  /** Kategoriler + sayıları (tek geçiş — büyük listelerde hızlı). */
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

  /** Sol sütunun nihai içeriği (liste ağacı veya düz kategoriler). */
  const sideItems = useMemo<SideItem[]>(() => {
    const favCount = baseList.filter(x => (favorites || []).includes(x.id)).length;
    const head: SideItem[] = [
      { kind: "category", name: FAV, count: favCount, playlistId: activePlaylist?.id || "" },
      { kind: "category", name: ALL, count: baseList.length, playlistId: activePlaylist?.id || "" },
    ];

    if (!multiPlaylist) {
      // TEK LİSTE: doğrudan kategoriler
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

    // ÇOK LİSTE: her liste bir düğüm; açık olanın kategorileri altında
    const out: SideItem[] = [];
    for (const pl of playlists) {
      const isActive = pl.id === activePlaylist?.id;
      const open = !!openPlaylists[pl.id];
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

  /** Orta sütun: seçili kategoriye ve aramaya göre süzülmüş kanallar. */
  const channels = useMemo(() => {
    let list = baseList;
    if (selectedCat === FAV) list = list.filter(x => (favorites || []).includes(x.id));
    else if (selectedCat !== ALL) list = list.filter(x => (x.group || "Diğer") === selectedCat);

    const q = search.trim().toLocaleLowerCase("tr");
    if (q) list = list.filter(x => String(x.name || "").toLocaleLowerCase("tr").includes(q));
    return list;
  }, [baseList, selectedCat, favorites, search]);

  const openItem = useCallback((item: any) => {
    haptic.light();
    if (tab === "live") {
      addToRecent(item.id);
      router.push({ pathname: "/player", params: { id: item.id } });
    } else {
      router.push({ pathname: "/detail", params: { type: tab, id: item.id } });
    }
  }, [tab, addToRecent, router]);

  /**
   * ══════════════════════════════════════════════════════════════════════
   * KUMANDA DESTEĞİ (v8.0.1)
   * ══════════════════════════════════════════════════════════════════════
   * Bu blok, tüm bağımlılıkları (openItem, highlighted, tab...) TANIMLANDIKTAN
   * SONRA yer alır. JavaScript'te const yukarı taşınmadığı için, hook'u yukarı
   * koymak sessizce "undefined" hatası üretirdi (v7.6.0'da bu hatayı yaşadık).
   */

  /** Sonraki/önceki kanala geç ve sağ panelde göster. */
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

  useRemoteKeys({
    // CH+ / CH- : listede kanal gezme (Homatics, Fire TV kumandaları)
    channelUp: () => stepChannel(1),
    channelDown: () => stepChannel(-1),
    // Oynat tuşu: seçili kanalı aç
    play: () => { if (highlighted) openItem(highlighted); },
    playPause: () => { if (highlighted) openItem(highlighted); },
    // Rehber tuşu: TV rehberine git
    guide: () => router.push("/epg-timeline"),
    // Bilgi tuşu: seçili kanalın detayına git (film/dizi ise)
    info: () => { if (highlighted && tab !== "live") openItem(highlighted); },
    // Uzun-bas geri: aramayı temizle ve TÜMÜ'ye dön (hızlı sıfırlama)
    backLongPress: () => {
      haptic.medium();
      setSearch("");
      setSelectedCat(ALL);
    },
  });

  /**
   * GERİ TUŞU (v8.0.1)
   * Kademeli davranış — yanlışlıkla uygulamadan düşmeyi zorlaştırır:
   *   1. Arama doluysa    -> aramayı temizle
   *   2. Kategori seçiliyse -> TÜMÜ'ye dön
   *   3. İkisi de temizse  -> profil seçimine dön (normal geri)
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (search.trim()) { setSearch(""); return true; }
      if (selectedCat !== ALL) { setSelectedCat(ALL); return true; }
      return false;   // varsayılan davranış
    });
    return () => sub.remove();
  }, [search, selectedCat]);

  const catLabel = (name: string) =>
    name === ALL ? "TÜMÜ" : name === FAV ? "⭐ FAVORİLER" : name;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.surface }]} testID="tv-home">
      {/* ÜST ŞERİT: sekmeler + liste adı + araçlar */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.brand, { color: colors.brandPrimary }]}>KIZILKAN</Text>

        {(["live", "vod", "series"] as Tab[]).map(t => (
          <FocusButton
            key={t}
            testID={`tvh-tab-${t}`}
            autoFocus={t === "live"}
            onPress={() => { setTab(t); setSelectedCat(ALL); setHighlighted(null); }}
            focusRadius={RADIUS.pill}
            style={[
              styles.tabBtn,
              { backgroundColor: tab === t ? colors.brandPrimary : colors.surfaceSecondary },
            ]}
          >
            <Text style={{ color: tab === t ? colors.onBrandPrimary : colors.onSurface, fontWeight: "700" }}>
              {t === "live" ? "Canlı" : t === "vod" ? "Filmler" : "Diziler"}
            </Text>
          </FocusButton>
        ))}

        <View style={{ flex: 1 }} />
        <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm }} numberOfLines={1}>
          {activePlaylist?.name || "—"}
        </Text>
        <FocusButton testID="tvh-settings" onPress={() => router.push("/(tabs)/settings")} focusRadius={20} style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={20} color={colors.onSurface} />
        </FocusButton>
      </View>

      <View style={styles.columns}>
        {/* ══ SOL: listeler + kategoriler ══ */}
        <View style={[styles.sideCol, { borderRightColor: colors.border }]}>
          <FlatList
            ref={sideScroll.listRef}
            data={sideItems}
            keyExtractor={(it, i) => (it.kind === "playlist" ? `p-${it.id}` : `c-${it.name}-${i}`)}
            onScrollToIndexFailed={sideScroll.onScrollToIndexFailed}
            getItemLayout={(_, index) => ({ length: SIDE_ROW_H, offset: SIDE_ROW_H * index, index })}
            renderItem={({ item, index }) => (
              <SideRow
                item={item}
                label={item.kind === "playlist" ? item.name : catLabel(item.name)}
                selected={item.kind === "category" && item.name === selectedCat}
                onFocusItem={() => sideScroll.onItemFocus(index)}
                onPress={async () => {
                  if (item.kind === "playlist") {
                    // Liste düğümü: aç/kapat + o listeyi aktif yap
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
        </View>

        {/* ══ ORTA: arama + kanallar ══ */}
        <View style={[styles.midCol, { borderRightColor: colors.border }]}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.onSurfaceTertiary} />
            <TextInput
              testID="tvh-search"
              value={search}
              onChangeText={setSearch}
              placeholder="Kanal ara…"
              placeholderTextColor={colors.onSurfaceTertiary}
              // TV'de klavye otomatik açılmasın (odağı kaçırır)
              autoFocus={false}
              style={{ flex: 1, color: colors.onSurface, paddingVertical: 6 }}
            />
          </View>

          <FlatList
            ref={chanScroll.listRef}
            data={channels}
            keyExtractor={(it: any) => String(it.id)}
            onScrollToIndexFailed={chanScroll.onScrollToIndexFailed}
            getItemLayout={(_, index) => ({ length: CHAN_ROW_H, offset: CHAN_ROW_H * index, index })}
            initialNumToRender={14}
            windowSize={9}
            ListEmptyComponent={
              <Text style={{ color: colors.onSurfaceSecondary, padding: SPACING.md }}>
                {search ? "Sonuç yok" : "Bu kategoride içerik yok"}
              </Text>
            }
            renderItem={({ item, index }) => (
              <ChanRow
                item={item}
                fav={isFavorite(item.id)}
                onFocusItem={() => { chanScroll.onItemFocus(index); setHighlighted(item); }}
                onPress={() => openItem(item)}
              />
            )}
          />
        </View>

        {/* ══ SAĞ: önizleme + bilgi ══ */}
        <View style={styles.rightCol}>
          {highlighted ? (
            <>
              <View style={[styles.previewBox, { backgroundColor: "#000", borderColor: colors.border }]}>
                {tvPreview ? (
                  <View style={styles.previewInner}>
                    {/* Canlı önizleme ağır olduğu için AYARDAN kapatılabilir.
                        Kapalıyken yalnızca logo gösterilir. */}
                    {highlighted.logo ? (
                      <Image source={{ uri: highlighted.logo }} style={styles.previewLogo} resizeMode="contain" />
                    ) : (
                      <Ionicons name="tv-outline" size={44} color={colors.onSurfaceTertiary} />
                    )}
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: FONT.size.xs, marginTop: 6 }}>
                      İzlemek için OK
                    </Text>
                  </View>
                ) : (
                  <View style={styles.previewInner}>
                    {highlighted.logo ? (
                      <Image source={{ uri: highlighted.logo }} style={styles.previewLogo} resizeMode="contain" />
                    ) : (
                      <Ionicons name="tv-outline" size={44} color={colors.onSurfaceTertiary} />
                    )}
                  </View>
                )}
              </View>

              <Text style={[styles.previewName, { color: colors.onSurface }]} numberOfLines={2}>
                {highlighted.name}
              </Text>
              <Text style={{ color: colors.onSurfaceSecondary, fontSize: FONT.size.sm }} numberOfLines={1}>
                {highlighted.group || "Diğer"}
              </Text>

              <View style={{ gap: SPACING.sm, marginTop: SPACING.md }}>
                <FocusButton
                  testID="tvh-play"
                  onPress={() => openItem(highlighted)}
                  focusRadius={RADIUS.pill}
                  style={[styles.actBtn, { backgroundColor: colors.brandPrimary }]}
                >
                  <Ionicons name="play" size={18} color={colors.onBrandPrimary} />
                  <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>Tam Ekran</Text>
                </FocusButton>

                <FocusButton
                  testID="tvh-fav"
                  onPress={() => { haptic.soft(); toggleFavorite(highlighted.id); }}
                  focusRadius={RADIUS.pill}
                  style={[styles.actBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 }]}
                >
                  <Ionicons
                    name={isFavorite(highlighted.id) ? "heart" : "heart-outline"}
                    size={18}
                    color={isFavorite(highlighted.id) ? colors.brandPrimary : colors.onSurface}
                  />
                  <Text style={{ color: colors.onSurface, fontWeight: "700" }}>
                    {isFavorite(highlighted.id) ? "Favoride" : "Favori"}
                  </Text>
                </FocusButton>

                <FocusButton
                  testID="tvh-multi"
                  onPress={() => router.push("/multi-view")}
                  focusRadius={RADIUS.pill}
                  style={[styles.actBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 }]}
                >
                  <Ionicons name="grid-outline" size={18} color={colors.onSurface} />
                  <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Çoklu Ekran</Text>
                </FocusButton>
              </View>
            </>
          ) : (
            <View style={styles.previewInner}>
              <Ionicons name="tv-outline" size={54} color={colors.onSurfaceTertiary} />
              <Text style={{ color: colors.onSurfaceSecondary, marginTop: SPACING.sm, textAlign: "center" }}>
                Bir kanalın üzerine gelin
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Sol sütun satırı (liste düğümü veya kategori). */
function SideRow({
  item, label, selected, onPress, onFocusItem,
}: {
  item: SideItem;
  label: string;
  selected: boolean;
  onPress: () => void;
  onFocusItem: () => void;
}) {
  const { colors } = useTheme();
  const { isFocused, onFocus, onBlur } = useTVFocus();
  const isPl = item.kind === "playlist";

  return (
    <FocusButton
      testID={`tvh-side-${label}`}
      onPress={onPress}
      onFocus={() => { onFocus(); onFocusItem(); }}
      onBlur={onBlur}
      focusRadius={RADIUS.sm}
      style={[
        styles.sideRow,
        selected && { backgroundColor: colors.brandPrimary + "33" },
        isFocused && rowFocusStyle(colors.brandPrimary, true, RADIUS.sm),
      ]}
    >
      {isPl && (
        <Ionicons
          name={(item as any).open ? "chevron-down" : "chevron-forward"}
          size={14}
          color={colors.onSurfaceSecondary}
        />
      )}
      <Text
        style={[
          styles.sideText,
          { color: selected ? colors.brandPrimary : colors.onSurface, fontWeight: isPl ? "800" : "500" },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: FONT.size.xs }}>{item.count}</Text>
    </FocusButton>
  );
}

/** Orta sütun kanal satırı. */
function ChanRow({
  item, fav, onPress, onFocusItem,
}: {
  item: any;
  fav: boolean;
  onPress: () => void;
  onFocusItem: () => void;
}) {
  const { colors } = useTheme();
  const { isFocused, onFocus, onBlur } = useTVFocus();

  return (
    <FocusButton
      testID={`tvh-chan-${item.id}`}
      onPress={onPress}
      onFocus={() => { onFocus(); onFocusItem(); }}
      onBlur={onBlur}
      focusRadius={RADIUS.sm}
      style={[
        styles.chanRow,
        isFocused && rowFocusStyle(colors.brandPrimary, true, RADIUS.sm),
      ]}
    >
      <View style={[styles.chanLogo, { backgroundColor: colors.surfaceTertiary }]}>
        {item.logo || item.poster ? (
          <Image source={{ uri: item.logo || item.poster }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
        ) : (
          <Ionicons name="tv-outline" size={16} color={colors.onSurfaceTertiary} />
        )}
      </View>
      <Text style={{ flex: 1, color: colors.onSurface, fontSize: FONT.size.sm }} numberOfLines={1}>
        {item.name}
      </Text>
      {fav ? <Ionicons name="heart" size={14} color={colors.brandPrimary} /> : null}
    </FocusButton>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1,
  },
  brand: { fontSize: 18, fontWeight: "800", letterSpacing: 3, marginRight: SPACING.sm },
  tabBtn: { paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.pill },
  iconBtn: { padding: 8, borderRadius: 20 },

  columns: { flex: 1, flexDirection: "row" },
  sideCol: { width: "24%", borderRightWidth: 1, paddingVertical: 4 },
  midCol: { width: "38%", borderRightWidth: 1, paddingHorizontal: 6, paddingTop: 6 },
  rightCol: { flex: 1, padding: SPACING.md },

  sideRow: {
    height: SIDE_ROW_H - 4, marginHorizontal: 4, marginBottom: 4,
    paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: RADIUS.sm,
  },
  sideText: { flex: 1, fontSize: FONT.size.sm },

  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 8, marginBottom: 6,
  },
  chanRow: {
    height: CHAN_ROW_H - 4, marginBottom: 4, paddingHorizontal: 8,
    flexDirection: "row", alignItems: "center", gap: 8, borderRadius: RADIUS.sm,
  },
  chanLogo: { width: 32, height: 32, borderRadius: 4, alignItems: "center", justifyContent: "center", overflow: "hidden" },

  previewBox: { width: "100%", aspectRatio: 16 / 9, borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden", marginBottom: SPACING.sm },
  previewInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  previewLogo: { width: "55%", height: "55%" },
  previewName: { fontSize: FONT.size.base, fontWeight: "800" },
  actBtn: { flexDirection: "row", height: 46, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center", gap: 8 },
});
