import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { SPACING, RADIUS, FONT } from "@/src/theme/themes";
import { usePlaylists } from "@/src/store/PlaylistContext";
import { useLibrary } from "@/src/store/LibraryContext";
import { api } from "@/src/utils/api";
import { ChannelRow } from "@/src/components/ChannelRow";
import { ChannelActionSheet, type ActionItem } from "@/src/components/ChannelActionSheet";
import { PosterGrid } from "@/src/components/PosterGrid";
import { KizilkanLogo } from "@/src/components/KizilkanLogo";
import { ChannelRowSkeleton as _ChannelRowSkeleton } from "@/src/components/Skeleton";
import { useProfiles } from "@/src/store/ProfileContext";
import { useParental } from "@/src/store/ParentalContext";
import { haptic } from "@/src/utils/haptic";
import type { NowNext, VodItem, SeriesItem } from "@/src/types";

const ALL = "__all__";
type Tab = "live" | "vod" | "series";

export default function LiveTV() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activePlaylist, playlists, toggleFavorite, isFavorite, addToRecent } = usePlaylists();
  const { activeProfile } = useProfiles();
  const { isCategoryLocked, isUnlockedInSession } = useParental();
  const { isItemHidden, isGroupHidden, hiddenModeUnlocked, toggleHiddenItem, toggleWatchlist, inWatchlist } = useLibrary();
  const [tab, setTab] = useState<Tab>("live");
  const [actionItem, setActionItem] = useState<any | null>(null);
  const [selectedCat, setSelectedCat] = useState<string>(ALL);
  const [epgMap, setEpgMap] = useState<Record<string, NowNext>>({});
  const [epgLoading, setEpgLoading] = useState(false);

  // Reset category when switching tabs
  useEffect(() => { setSelectedCat(ALL); }, [tab]);

  const requiresPin = (group?: string | null) => {
    if (!group) return false;
    if (!isCategoryLocked(group)) return false;
    return !isUnlockedInSession(group);
  };

  const guardedOpenChannel = (item: any) => {
    if (requiresPin(item.group)) {
      router.push({ pathname: "/pin-entry", params: { category: item.group } });
      return;
    }
    haptic.light();
    addToRecent(item.id);
    router.push({ pathname: "/player", params: { id: item.id } });
  };

  // Uzun-bas menüsünü açar (artık zengin bottom sheet — IPTV Extreme tarzı).
  const showChannelActions = (item: any) => {
    haptic.medium();
    setActionItem(item);
  };

  // Aktif item için menü öğelerini üretir (canlı/vod/dizi'ye göre farklı).
  const buildActions = (item: any): ActionItem[] => {
    if (!item) return [];
    const isFav = isFavorite(item.id);
    const isLive = tab === "live";
    const isInWatchlist = !isLive ? inWatchlist(item.id) : false;
    const list: ActionItem[] = [];

    // Oynat
    list.push({
      icon: "play-circle",
      label: "Oynat",
      onPress: () => {
        if (isLive) {
          addToRecent(item.id);
          router.push({ pathname: "/player", params: { id: item.id } });
        } else {
          router.push({ pathname: "/detail", params: { type: tab, id: item.id } });
        }
      },
    });

    // Bilgi (vod/dizi)
    if (!isLive) {
      list.push({
        icon: "information-circle",
        label: "Bilgi / Detay",
        onPress: () => router.push({ pathname: "/detail", params: { type: tab, id: item.id } }),
      });
    }

    // EPG (canlı)
    if (isLive && (item.epg_channel_id || item.tvg_id)) {
      list.push({
        icon: "calendar",
        label: "Program Rehberi (EPG)",
        onPress: () => router.push({ pathname: "/epg", params: { channel: item.id } }),
      });
    }

    // Catch-up (canlı + arşiv varsa)
    if (isLive && item.tv_archive === 1) {
      list.push({
        icon: "time",
        label: "Geriye Dönük İzle (Catch-up)",
        onPress: () => router.push({ pathname: "/catchup", params: { channel: item.id } }),
      });
    }

    // Favori
    list.push({
      icon: isFav ? "heart" : "heart-outline",
      label: isFav ? "Favoriden çıkar" : "Favoriye ekle",
      active: isFav,
      onPress: () => { haptic.soft(); toggleFavorite(item.id); },
    });

    // İzleme listesi (vod/dizi)
    if (!isLive) {
      list.push({
        icon: isInWatchlist ? "bookmark" : "bookmark-outline",
        label: isInWatchlist ? "İzleme listesinden çıkar" : "İzleme listesine ekle",
        active: isInWatchlist,
        onPress: () => { haptic.soft(); toggleWatchlist(item.id); },
      });
    }

    // Gizle
    list.push({
      icon: "eye-off",
      label: "Gizle (PIN gerekir)",
      destructive: true,
      onPress: () => { haptic.warning(); toggleHiddenItem(item.id); },
    });

    return list;
  };
  const guardedOpenDetail = (item: any) => {
    if (requiresPin(item.group)) {
      router.push({ pathname: "/pin-entry", params: { category: item.group } });
      return;
    }
    haptic.light();
    router.push({ pathname: "/detail", params: { type: tab, id: item.id } });
  };

  const currentList = useMemo(() => {
    if (!activePlaylist) return [] as any[];
    let list: any[] = [];
    if (tab === "live") list = activePlaylist.channels;
    else if (tab === "vod") list = activePlaylist.vod || [];
    else list = activePlaylist.series || [];
    // Kids profile: hide locked categories entirely
    if (activeProfile?.isKids) {
      list = list.filter((c: any) => !isCategoryLocked(c.group || ""));
    }
    // Hidden items (per-profile, until session unlock)
    if (!hiddenModeUnlocked) {
      list = list.filter((c: any) => !isItemHidden(c.id) && !(c.group && isGroupHidden(c.group)));
    }
    return list;
  }, [activePlaylist, tab, activeProfile?.isKids, isCategoryLocked, hiddenModeUnlocked, isItemHidden, isGroupHidden]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    currentList.forEach((c: any) => { if (c.group) set.add(c.group); });
    return Array.from(set).sort();
  }, [currentList]);

  const filtered = useMemo(() => {
    if (selectedCat === ALL) return currentList;
    return currentList.filter((c: any) => (c.group || "Diğer") === selectedCat);
  }, [currentList, selectedCat]);

  // Fetch EPG for live — supports Xtream (client-side) + XMLTV (backend)
  useEffect(() => {
    if (tab !== "live" || !activePlaylist) return;
    const chList = filtered as any[];
    if (chList.length === 0) return;
    let cancelled = false;
    setEpgLoading(true);

    (async () => {
      try {
        // Xtream: client-side short_epg per stream
        if (activePlaylist.source === "xtream" && activePlaylist.xtreamServer && activePlaylist.xtreamUsername && activePlaylist.xtreamPassword) {
          const cred = {
            server: activePlaylist.xtreamServer,
            username: activePlaylist.xtreamUsername,
            password: activePlaylist.xtreamPassword,
          };
          const { xtreamNowNextBatch } = await import("@/src/utils/iptv");
          const ids = chList.slice(0, 40).map(c => c.stream_id).filter(Boolean) as string[];
          if (ids.length > 0) {
            const map = await xtreamNowNextBatch(cred, ids);
            if (cancelled) return;
            // Remap keys from stream_id → epg_channel_id (what ChannelRow expects)
            const out: Record<string, NowNext> = {};
            for (const ch of chList) {
              const sid = ch.stream_id;
              if (sid && map[sid]) {
                const key = ch.epg_channel_id || ch.tvg_id || sid;
                const now = map[sid].now;
                const next = map[sid].next;
                out[key] = {
                  now: now ? { title: now.title, description: now.description || undefined, start: now.start_timestamp ? new Date(now.start_timestamp * 1000).toISOString() : now.start, stop: now.stop_timestamp ? new Date(now.stop_timestamp * 1000).toISOString() : now.stop } : null,
                  next: next ? { title: next.title, description: next.description || undefined, start: next.start_timestamp ? new Date(next.start_timestamp * 1000).toISOString() : next.start, stop: next.stop_timestamp ? new Date(next.stop_timestamp * 1000).toISOString() : next.stop } : null,
                } as any;
              }
            }
            if (!cancelled) setEpgMap(prev => ({ ...prev, ...out }));
          }
        } else if (activePlaylist.epgUrl) {
          // CİHAZ-İÇİ XMLTV (backend YOK)
          const ids = chList
            .map(c => c.epg_channel_id || c.tvg_id)
            .filter((x): x is string => !!x)
            .slice(0, 200);
          if (ids.length > 0) {
            const { getNowNext } = await import("@/src/utils/epg");
            const res = await getNowNext(activePlaylist.id, ids, activePlaylist.epgUrl);
            if (!cancelled) setEpgMap(res.data as Record<string, NowNext>);
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setEpgLoading(false);
    })();

    return () => { cancelled = true; };
  }, [activePlaylist?.id, activePlaylist?.epgUrl, activePlaylist, filtered, tab]);

  if (!activePlaylist) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]} testID="live-tv-empty">
        <View style={styles.emptyWrap}>
          <Ionicons name="albums-outline" size={60} color={colors.onSurfaceSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Aktif liste yok</Text>
          <Text style={[styles.emptySub, { color: colors.onSurfaceSecondary }]}>Başlamak için bir oynatma listesi ekleyin.</Text>
          <TouchableOpacity
            testID="empty-add-btn"
            onPress={() => router.push("/add-playlist")}
            style={[styles.emptyBtn, { backgroundColor: colors.brandPrimary }]}
          >
            <Text style={[styles.emptyBtnText, { color: colors.onBrandPrimary }]}>Liste Ekle</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const hasVod = (activePlaylist.vod?.length || 0) > 0;
  const hasSeries = (activePlaylist.series?.length || 0) > 0;

  const StickyHeader = (
    <>
      <View style={styles.segmentWrap}>
        <View style={[styles.segment, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <TouchableOpacity
            testID="seg-live"
            onPress={() => { haptic.soft(); setTab("live"); setSelectedCat(ALL); }}
            focusable
            hasTVPreferredFocus={tab === "live"}
            style={[styles.segmentItem, tab === "live" && { backgroundColor: colors.brandPrimary }]}
          >
            <Ionicons name="tv" size={18} color={tab === "live" ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
            <Text style={[styles.segmentText, { color: tab === "live" ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>
              Canlı ({activePlaylist.channels.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="seg-vod"
            onPress={() => { haptic.soft(); setTab("vod"); setSelectedCat(ALL); }}
            focusable
            hasTVPreferredFocus={tab === "vod"}
            style={[styles.segmentItem, tab === "vod" && { backgroundColor: colors.brandPrimary }, !hasVod && styles.segmentDisabled]}
            disabled={!hasVod}
          >
            <Ionicons name="film" size={18} color={!hasVod ? colors.onSurfaceTertiary : tab === "vod" ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
            <Text style={[styles.segmentText, { color: !hasVod ? colors.onSurfaceTertiary : tab === "vod" ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>
              Filmler{hasVod ? ` (${activePlaylist.vod!.length})` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="seg-series"
            onPress={() => { haptic.soft(); setTab("series"); setSelectedCat(ALL); }}
            focusable
            hasTVPreferredFocus={tab === "series"}
            style={[styles.segmentItem, tab === "series" && { backgroundColor: colors.brandPrimary }, !hasSeries && styles.segmentDisabled]}
            disabled={!hasSeries}
          >
            <Ionicons name="albums" size={18} color={!hasSeries ? colors.onSurfaceTertiary : tab === "series" ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
            <Text style={[styles.segmentText, { color: !hasSeries ? colors.onSurfaceTertiary : tab === "series" ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>
              Diziler{hasSeries ? ` (${activePlaylist.series!.length})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.chipRowContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <CategoryChip label={`Tümü (${currentList.length})`} active={selectedCat === ALL} onPress={() => setSelectedCat(ALL)} testID="chip-all" />
          {categories.map(cat => {
            const cnt = currentList.filter((c: any) => (c.group || "Diğer") === cat).length;
            return (
              <CategoryChip
                key={cat}
                label={`${cat} (${cnt})`}
                active={selectedCat === cat}
                onPress={() => setSelectedCat(cat)}
                testID={`chip-${cat}`}
              />
            );
          })}
          {categories.length === 0 && currentList.length === 0 && (
            <Text style={{ color: colors.onSurfaceTertiary, paddingVertical: SPACING.sm, fontSize: FONT.size.sm }}>
              {tab === "vod" ? "Bu listede film yok" : tab === "series" ? "Bu listede dizi yok" : "Kanal yok"}
            </Text>
          )}
        </ScrollView>
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]} testID="live-tv-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <KizilkanLogo size="md" showSubtitle={false} showIcon align="left" />
          <Text style={[styles.subtitle, { color: colors.onSurfaceSecondary }]} numberOfLines={1}>
            {activePlaylist.name} • {activePlaylist.channels.length} kanal
            {hasVod ? ` • ${activePlaylist.vod!.length} film` : ""}
            {hasSeries ? ` • ${activePlaylist.series!.length} dizi` : ""}
          </Text>
        </View>
        {epgLoading && <ActivityIndicator size="small" color={colors.brandPrimary} />}
        <TouchableOpacity
          testID="open-multi-view-btn"
          onPress={() => router.push("/multi-view")}
          hitSlop={10}
          style={{ marginLeft: SPACING.sm }}
        >
          <Ionicons name="grid" size={20} color={colors.onSurface} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="open-epg-timeline-btn"
          onPress={() => router.push("/epg-timeline")}
          hitSlop={10}
          style={{ marginLeft: SPACING.md }}
        >
          <Ionicons name="calendar" size={20} color={colors.onSurface} />
        </TouchableOpacity>
        {playlists.length > 1 && (
          <TouchableOpacity
            testID="switch-playlist-btn"
            onPress={() => router.push("/(tabs)/settings")}
            hitSlop={10}
            focusable
            style={{ marginLeft: SPACING.md }}
          >
            <Ionicons name="swap-horizontal" size={20} color={colors.onSurface} />
          </TouchableOpacity>
        )}
      </View>

      {tab === "live" ? (
        <>
          {StickyHeader}
          <FlatList
            data={filtered as any[]}
            keyExtractor={c => c.id}
            contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xxxl }}
            renderItem={({ item }) => (
              <ChannelRow
                channel={item}
                epg={epgMap[item.epg_channel_id || item.tvg_id || ""] || null}
                isFavorite={isFavorite(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
                onPress={() => guardedOpenChannel(item)}
                onLongPress={() => showChannelActions(item)}
              />
            )}
            initialNumToRender={12}
            windowSize={7}
            removeClippedSubviews
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyTitle, { color: colors.onSurfaceSecondary }]}>Bu kategoride kanal yok</Text>
              </View>
            }
          />
        </>
      ) : (
        <PosterGrid
          items={filtered as (VodItem | SeriesItem)[]}
          testIDPrefix={tab === "vod" ? "vod" : "series"}
          onPressItem={(item) => guardedOpenDetail(item)}
          ListHeaderComponent={StickyHeader as any}
          emptyText={tab === "vod" ? "Bu kategoride film yok" : "Bu kategoride dizi yok"}
        />
      )}

      <ChannelActionSheet
        visible={!!actionItem}
        title={actionItem?.name || ""}
        subtitle={actionItem?.group || (tab === "live" ? "Canlı Kanal" : tab === "vod" ? "Film" : "Dizi")}
        actions={buildActions(actionItem)}
        onClose={() => setActionItem(null)}
      />
    </SafeAreaView>
  );
}

function CategoryChip({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.75}
      focusable
      style={[
        styles.chip,
        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
        active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
      ]}
    >
      <Text
        style={[styles.chipText, { color: colors.onSurfaceSecondary }, active && { color: colors.onBrandPrimary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.sm,
  },
  brand: { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, letterSpacing: 2 },
  subtitle: { fontSize: FONT.size.sm, marginTop: 4 },
  segmentWrap: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  segment: {
    flexDirection: "row",
    borderRadius: RADIUS.pill,
    padding: 4,
    borderWidth: 1,
  },
  segmentItem: {
    flex: 1, height: 48, borderRadius: RADIUS.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingHorizontal: SPACING.sm,
  },
  segmentDisabled: { opacity: 0.4 },
  segmentText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  chipRowContainer: { height: 56, justifyContent: "center" },
  chipRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg, alignItems: "center" },
  chip: {
    height: 36, borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: SPACING.md, justifyContent: "center", flexShrink: 0,
  },
  chipText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  emptyWrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: SPACING.xl, gap: SPACING.md,
  },
  emptyTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, marginTop: SPACING.md },
  emptySub: { fontSize: FONT.size.base, textAlign: "center" },
  emptyBtn: {
    marginTop: SPACING.md, paddingHorizontal: SPACING.xl, height: 48, borderRadius: RADIUS.pill,
    alignItems: "center", justifyContent: "center",
  },
  emptyBtnText: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
});
