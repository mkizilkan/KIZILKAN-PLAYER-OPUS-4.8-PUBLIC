import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Image, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { SPACING, RADIUS, FONT } from "@/src/theme/themes";
import { usePlaylists } from "@/src/store/PlaylistContext";
import { useLibrary } from "@/src/store/LibraryContext";
import { ChannelRow } from "@/src/components/ChannelRow";
import { haptic } from "@/src/utils/haptic";

type Tab = "continue" | "favorites" | "watchlist" | "recent";

export default function LibraryTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activePlaylist, favorites, recent, toggleFavorite, isFavorite, addToRecent, clearRecent } = usePlaylists();
  const { watchProgress, watchlist, toggleWatchlist, clearProgress, clearAllProgress } = useLibrary();
  const [tab, setTab] = useState<Tab>("favorites");
  const { width } = useWindowDimensions();

  // Continue watching (VOD & Series)
  const continueList = useMemo(() => {
    if (!activePlaylist) return [] as { id: string; name: string; poster?: string | null; progress: number; kind: string; group?: string | null; }[];
    const vodMap = new Map((activePlaylist.vod || []).map(v => [v.id, v]));
    const seriesMap = new Map((activePlaylist.series || []).map(s => [s.id, s]));
    return Object.entries(watchProgress)
      .filter(([, v]) => v.duration > 0 && v.current / v.duration > 0.02 && v.current / v.duration < 0.95)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .map(([id, v]) => {
        const src: any = vodMap.get(id) || seriesMap.get(id);
        return {
          id,
          name: v.name || src?.name || "Bilinmeyen",
          poster: v.poster || src?.poster,
          progress: v.current / v.duration,
          kind: v.kind,
          group: src?.group,
        };
      });
  }, [activePlaylist, watchProgress]);

  const favChannels = useMemo(() => {
    if (!activePlaylist) return [] as any[];
    const map = new Map(activePlaylist.channels.map(c => [c.id, c]));
    return favorites.map(id => map.get(id)).filter(Boolean) as any[];
  }, [activePlaylist, favorites]);

  const recentChannels = useMemo(() => {
    if (!activePlaylist) return [] as any[];
    const map = new Map(activePlaylist.channels.map(c => [c.id, c]));
    return recent.map(id => map.get(id)).filter(Boolean) as any[];
  }, [activePlaylist, recent]);

  const watchlistItems = useMemo(() => {
    if (!activePlaylist) return [] as any[];
    const vMap = new Map((activePlaylist.vod || []).map(v => [v.id, { ...v, __kind: "vod" }]));
    const sMap = new Map((activePlaylist.series || []).map(s => [s.id, { ...s, __kind: "series" }]));
    return watchlist.map(id => vMap.get(id) || sMap.get(id)).filter(Boolean) as any[];
  }, [activePlaylist, watchlist]);

  const posterW = Math.min(140, (width - SPACING.lg * 2 - SPACING.sm * 2) / 3);
  const posterH = posterW * 1.5;

  const openVideo = (id: string, kind: string) => {
    haptic.light();
    if (kind === "live") {
      addToRecent(id);
      router.push({ pathname: "/player", params: { id } });
    } else {
      router.push({ pathname: "/detail", params: { type: kind, id } });
    }
  };

  const tabDefs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: "continue", label: "Devam Et", icon: "play-circle", count: continueList.length },
    { key: "favorites", label: "Favoriler", icon: "heart", count: favChannels.length },
    { key: "watchlist", label: "İzleyeceğim", icon: "bookmark", count: watchlistItems.length },
    { key: "recent", label: "Son", icon: "time", count: recentChannels.length },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]} testID="favorites-screen">
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Kütüphanem</Text>
        <TouchableOpacity
          testID="library-stats-btn"
          onPress={() => { haptic.soft(); router.push("/stats"); }}
          hitSlop={10}
          style={styles.iconAction}
        >
          <Ionicons name="stats-chart" size={22} color={colors.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {tabDefs.map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              testID={`lib-tab-${t.key}`}
              onPress={() => { haptic.soft(); setTab(t.key); }}
              style={[
                styles.chip,
                { backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary, borderColor: active ? colors.brandPrimary : colors.border },
              ]}
            >
              <Ionicons name={t.icon} size={14} color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
              <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>
                {t.label}{t.count > 0 ? ` (${t.count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tab === "continue" && (
        <FlatList
          data={continueList}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xxxl }}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`continue-${item.id}`}
              onPress={() => openVideo(item.id, item.kind)}
              activeOpacity={0.75}
              style={[styles.continueCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <View style={[styles.continuePoster, { backgroundColor: colors.surfaceTertiary }]}>
                {item.poster ? (
                  <Image source={{ uri: item.poster }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <Ionicons name={item.kind === "series" ? "albums" : "film"} size={26} color={colors.onSurfaceSecondary} />
                )}
                <View style={styles.playOverlay}>
                  <Ionicons name="play-circle" size={34} color="#fff" />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contName, { color: colors.onSurface }]} numberOfLines={2}>{item.name}</Text>
                <Text style={[styles.contMeta, { color: colors.onSurfaceSecondary }]}>
                  {item.kind === "series" ? "Dizi" : "Film"} • %{Math.round(item.progress * 100)} izlendi
                </Text>
                <View style={[styles.progressBg, { backgroundColor: colors.surfaceTertiary }]}>
                  <View style={[styles.progressFill, { backgroundColor: colors.brandPrimary, width: `${item.progress * 100}%` }]} />
                </View>
              </View>
              <TouchableOpacity
                testID={`continue-remove-${item.id}`}
                onPress={() => { haptic.warning(); clearProgress(item.id); }}
                hitSlop={10}
                style={{ padding: SPACING.xs }}
              >
                <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            continueList.length > 0 ? (
              <TouchableOpacity
                testID="clear-all-progress-btn"
                onPress={() => { haptic.warning(); clearAllProgress(); }}
                style={styles.footerBtn}
              >
                <Text style={[styles.footerBtnText, { color: colors.error }]}>Tümünü Temizle</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <EmptyBlock icon="play-circle-outline" text="Devam edilecek bir film veya dizi yok" />
          }
        />
      )}

      {tab === "favorites" && (
        <FlatList
          data={favChannels}
          keyExtractor={c => c.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xxxl }}
          renderItem={({ item }) => (
            <ChannelRow
              channel={item}
              isFavorite={isFavorite(item.id)}
              onToggleFavorite={() => { haptic.soft(); toggleFavorite(item.id); }}
              onPress={() => {
                haptic.light();
                addToRecent(item.id);
                router.push({ pathname: "/player", params: { id: item.id } });
              }}
            />
          )}
          ListEmptyComponent={<EmptyBlock icon="heart-outline" text="Henüz favori kanalınız yok" />}
        />
      )}

      {tab === "watchlist" && (
        <FlatList
          data={watchlistItems}
          keyExtractor={i => i.id}
          numColumns={3}
          key="watchlist-grid"
          columnWrapperStyle={{ gap: SPACING.sm, paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm }}
          contentContainerStyle={{ paddingTop: SPACING.md, paddingBottom: SPACING.xxxl }}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`watchlist-${item.id}`}
              onPress={() => openVideo(item.id, item.__kind)}
              style={{ width: posterW }}
              activeOpacity={0.8}
            >
              <View style={[styles.gridPoster, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, height: posterH }]}>
                {item.poster ? (
                  <Image source={{ uri: item.poster }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <Ionicons name={item.__kind === "series" ? "albums-outline" : "film-outline"} size={28} color={colors.onSurfaceSecondary} />
                )}
                <TouchableOpacity
                  testID={`watchlist-remove-${item.id}`}
                  onPress={() => { haptic.warning(); toggleWatchlist(item.id); }}
                  hitSlop={10}
                  style={styles.wlRemove}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={[styles.gridName, { color: colors.onSurface }]} numberOfLines={2}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyBlock icon="bookmark-outline" text="İzleme listenize film/dizi ekleyin (detay sayfasından)" />
          }
        />
      )}

      {tab === "recent" && (
        <FlatList
          data={recentChannels}
          keyExtractor={c => c.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xxxl }}
          renderItem={({ item }) => (
            <ChannelRow
              channel={item}
              isFavorite={isFavorite(item.id)}
              onToggleFavorite={() => { haptic.soft(); toggleFavorite(item.id); }}
              onPress={() => {
                haptic.light();
                addToRecent(item.id);
                router.push({ pathname: "/player", params: { id: item.id } });
              }}
            />
          )}
          ListFooterComponent={
            recentChannels.length > 0 ? (
              <TouchableOpacity
                testID="clear-recent-btn"
                onPress={() => { haptic.warning(); clearRecent(); }}
                style={styles.footerBtn}
              >
                <Text style={[styles.footerBtnText, { color: colors.error }]}>Geçmişi Temizle</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={<EmptyBlock icon="time-outline" text="Henüz izleme geçmişiniz yok" />}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyBlock({ icon, text }: { icon: any; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={60} color={colors.onSurfaceSecondary} />
      <Text style={[styles.emptyText, { color: colors.onSurfaceSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.sm,
  },
  title: { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, flex: 1 },
  iconAction: { padding: 8, borderRadius: RADIUS.md },
  chipRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  chip: {
    height: 36, borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: SPACING.md, flexDirection: "row", alignItems: "center", gap: 6,
  },
  chipText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  continueCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, marginBottom: SPACING.sm,
  },
  continuePoster: { width: 80, height: 110, borderRadius: RADIUS.sm, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  playOverlay: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  contName: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  contMeta: { fontSize: FONT.size.xs, marginTop: 4, marginBottom: 8 },
  progressBg: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  footerBtn: { alignItems: "center", padding: SPACING.md, marginTop: SPACING.md },
  footerBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  gridPoster: {
    width: "100%", borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden",
    alignItems: "center", justifyContent: "center", position: "relative",
  },
  gridName: { marginTop: 6, fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, minHeight: 34 },
  wlRemove: {
    position: "absolute", top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center",
  },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: SPACING.xxxl, gap: SPACING.md, paddingHorizontal: SPACING.xl },
  emptyText: { fontSize: FONT.size.base, textAlign: "center" },
});
