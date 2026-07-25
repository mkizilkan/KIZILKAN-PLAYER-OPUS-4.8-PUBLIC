import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/src/theme/ThemeContext";
import { SPACING, RADIUS, FONT } from "@/src/theme/themes";
import { usePlaylists } from "@/src/store/PlaylistContext";
import { useLibrary } from "@/src/store/LibraryContext";
import { useDownloads } from "@/src/store/DownloadContext";
import { api } from "@/src/utils/api";
import { storage } from "@/src/utils/storage";
import { haptic } from "@/src/utils/haptic";

const EPISODE_URL_KEY = "kizilkan.episode.url.";

export default function DetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ type: string; id: string }>();
  const { activePlaylist, addToRecent } = usePlaylists();
  const { toggleWatchlist, inWatchlist, watchProgress, toggleHiddenItem, isItemHidden } = useLibrary();
  const { add: addDownload, isDownloaded, getLocalUri } = useDownloads();

  const [info, setInfo] = useState<any>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSeries = params.type === "series";
  const item = useMemo(() => {
    if (!activePlaylist) return null;
    const list = isSeries ? (activePlaylist.series || []) : (activePlaylist.vod || []);
    return list.find(x => x.id === params.id) || null;
  }, [activePlaylist, params.id, isSeries]);

  useEffect(() => {
    if (!activePlaylist || !item) { setLoading(false); return; }
    if (activePlaylist.source !== "xtream") { setLoading(false); return; }
    setLoading(true);
    const { xtreamServer, xtreamUsername, xtreamPassword } = activePlaylist;
    const call = isSeries
      ? api.xtreamSeriesInfo(xtreamServer!, xtreamUsername!, xtreamPassword!, String((item as any).series_id))
      : api.xtreamVodInfo(xtreamServer!, xtreamUsername!, xtreamPassword!, String((item as any).stream_id));
    call
      .then((res: any) => {
        setInfo(res.info || {});
        if (isSeries) setSeasons(res.seasons || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [activePlaylist, item, isSeries]);

  if (!item) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.onSurface, padding: SPACING.lg }}>İçerik bulunamadı</Text>
      </SafeAreaView>
    );
  }

  const poster = (item as any).poster || info?.movie_image || info?.cover_big;

  const handlePlayVod = async () => {
    if (!("url" in item) || !item.url) return;
    // Store movie URL under a synthetic channel id and navigate to player
    const syntheticId = `vodplay-${item.id}`;
    await storage.setItem(EPISODE_URL_KEY + syntheticId, JSON.stringify({
      url: (item as any).url,
      name: item.name,
      group: "Film",
      container_ext: (item as any).container_ext || "mp4",
    }));
    addToRecent(item.id);
    router.push({ pathname: "/player", params: { id: syntheticId, ext: "true" } });
  };

  const handlePlayEpisode = async (ep: any) => {
    const syntheticId = `epplay-${ep.id}`;
    await storage.setItem(EPISODE_URL_KEY + syntheticId, JSON.stringify({
      url: ep.url,
      name: `${item.name} • ${ep.title}`,
      group: "Dizi",
      container_ext: ep.container_ext || "mp4",
    }));
    addToRecent(item.id);
    router.push({ pathname: "/player", params: { id: syntheticId, ext: "true" } });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["bottom"]} testID="detail-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xxxl }}>
        <View style={styles.heroWrap}>
          {poster ? (
            <Image source={{ uri: poster }} style={styles.heroImg} resizeMode="cover" blurRadius={20} />
          ) : (
            <View style={[styles.heroImg, { backgroundColor: colors.surfaceSecondary }]} />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.4)", "transparent", colors.surface]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={["top"]} style={styles.heroSafe}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn} testID="detail-back-btn">
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.heroContent}>
            <View style={styles.posterFrame}>
              {poster ? (
                <Image source={{ uri: poster }} style={styles.posterImg} resizeMode="cover" />
              ) : (
                <View style={[styles.posterImg, { backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }]}>
                  <Ionicons name={isSeries ? "albums" : "film"} size={40} color={colors.onSurfaceSecondary} />
                </View>
              )}
            </View>
            <View style={styles.heroInfo}>
              <Text style={[styles.title, { color: "#fff" }]} numberOfLines={3}>{item.name}</Text>
              <View style={styles.metaRow}>
                {(item as any).rating_5based ? (
                  <View style={styles.metaChip}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.metaText}>{Number((item as any).rating_5based).toFixed(1)}</Text>
                  </View>
                ) : null}
                {info?.releasedate || (item as any).release_date || (item as any).year ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaText}>
                      {(info?.releasedate || (item as any).release_date || (item as any).year || "").toString().slice(0, 4)}
                    </Text>
                  </View>
                ) : null}
                {info?.duration ? (
                  <View style={styles.metaChip}>
                    <Ionicons name="time-outline" size={12} color="#fff" />
                    <Text style={styles.metaText}>{info.duration}</Text>
                  </View>
                ) : null}
                {info?.genre || (item as any).genre ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaText} numberOfLines={1}>{info?.genre || (item as any).genre}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={{ padding: SPACING.xl }}><ActivityIndicator color={colors.brandPrimary} /></View>
        ) : (
          <View style={{ padding: SPACING.lg }}>
            {!isSeries && (
              <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                <TouchableOpacity
                  testID="play-vod-btn"
                  onPress={() => { haptic.medium(); handlePlayVod(); }}
                  activeOpacity={0.85}
                  focusable
                  style={[styles.playBtn, { backgroundColor: colors.brandPrimary, flex: 1 }]}
                >
                  <Ionicons name={watchProgress[item.id] ? "play-circle" : "play"} size={22} color={colors.onBrandPrimary} />
                  <Text style={[styles.playBtnText, { color: colors.onBrandPrimary }]}>
                    {watchProgress[item.id] ? "Devam Et" : "Oynat"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="watchlist-btn"
                  onPress={() => { haptic.soft(); toggleWatchlist(item.id); }}
                  activeOpacity={0.75}
                  style={[styles.iconAction, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                >
                  <Ionicons name={inWatchlist(item.id) ? "bookmark" : "bookmark-outline"} size={22} color={inWatchlist(item.id) ? colors.brandPrimary : colors.onSurface} />
                </TouchableOpacity>
                <TouchableOpacity
                  testID="hide-item-btn"
                  onPress={() => { haptic.warning(); toggleHiddenItem(item.id); }}
                  activeOpacity={0.75}
                  style={[styles.iconAction, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                >
                  <Ionicons name={isItemHidden(item.id) ? "eye-off" : "eye-outline"} size={22} color={isItemHidden(item.id) ? colors.brandPrimary : colors.onSurface} />
                </TouchableOpacity>
              </View>
            )}
            {isSeries && (
              <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                <TouchableOpacity
                  testID="watchlist-btn"
                  onPress={() => { haptic.soft(); toggleWatchlist(item.id); }}
                  activeOpacity={0.75}
                  style={[styles.iconAction, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, flex: 1 }]}
                >
                  <Ionicons name={inWatchlist(item.id) ? "bookmark" : "bookmark-outline"} size={22} color={inWatchlist(item.id) ? colors.brandPrimary : colors.onSurface} />
                  <Text style={{ color: colors.onSurface, fontWeight: FONT.weight.bold, marginLeft: 8 }}>
                    {inWatchlist(item.id) ? "İzleme Listemde" : "İzleme Listeme Ekle"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="hide-item-btn"
                  onPress={() => { haptic.warning(); toggleHiddenItem(item.id); }}
                  activeOpacity={0.75}
                  style={[styles.iconAction, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                >
                  <Ionicons name={isItemHidden(item.id) ? "eye-off" : "eye-outline"} size={22} color={isItemHidden(item.id) ? colors.brandPrimary : colors.onSurface} />
                </TouchableOpacity>
              </View>
            )}
            {!isSeries && !!(item as any).url && (
              <TouchableOpacity
                testID="download-vod-btn"
                onPress={async () => {
                  if (isDownloaded(item.id)) {
                    const uri = getLocalUri(item.id);
                    if (uri) {
                      const synth = { id: `dl-${item.id}`, url: uri, name: item.name, group: "İndirilenler", container_ext: (item as any).container_ext || "mp4", poster: item.poster };
                      await storage.setItem(EPISODE_URL_KEY + synth.id, JSON.stringify(synth));
                      router.push({ pathname: "/player", params: { id: synth.id } });
                    }
                  } else {
                    haptic.medium();
                    await addDownload({
                      id: item.id,
                      name: item.name,
                      poster: item.poster,
                      sourceUrl: (item as any).url,
                      ext: (item as any).container_ext || "mp4",
                      kind: "vod",
                    });
                    router.push("/downloads");
                  }
                }}
                activeOpacity={0.75}
                style={[styles.iconAction, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, flex: 1, marginTop: SPACING.sm }]}
              >
                <Ionicons
                  name={isDownloaded(item.id) ? "checkmark-circle" : "cloud-download-outline"}
                  size={22}
                  color={isDownloaded(item.id) ? "#00C853" : colors.brandPrimary}
                />
                <Text style={{ color: colors.onSurface, fontWeight: FONT.weight.bold, marginLeft: 8 }}>
                  {isDownloaded(item.id) ? "Çevrimdışı Hazır" : "İndir"}
                </Text>
              </TouchableOpacity>
            )}

            {(info?.plot || info?.description || (item as any).plot) ? (
              <View style={{ marginTop: SPACING.lg }}>
                <Text style={[styles.sectionTitle, { color: colors.onSurfaceSecondary }]}>KONU</Text>
                <Text style={[styles.plotText, { color: colors.onSurface }]}>
                  {info?.plot || info?.description || (item as any).plot}
                </Text>
              </View>
            ) : null}

            <View style={styles.detailsGrid}>
              {info?.cast || (item as any).cast ? (
                <DetailRow label="Oyuncular" value={info?.cast || (item as any).cast} />
              ) : null}
              {info?.director || (item as any).director ? (
                <DetailRow label="Yönetmen" value={info?.director || (item as any).director} />
              ) : null}
              {info?.country ? <DetailRow label="Ülke" value={info.country} /> : null}
              {info?.rating || (item as any).rating ? <DetailRow label="Puan" value={String(info?.rating || (item as any).rating)} /> : null}
            </View>

            {isSeries && seasons.length > 0 && (
              <View style={{ marginTop: SPACING.xl }}>
                <Text style={[styles.sectionTitle, { color: colors.onSurfaceSecondary }]}>BÖLÜMLER</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm, marginBottom: SPACING.md }}>
                  {seasons.map((s, idx) => {
                    const active = selectedSeasonIdx === idx;
                    return (
                      <TouchableOpacity
                        key={s.season}
                        testID={`season-${s.season}-btn`}
                        onPress={() => setSelectedSeasonIdx(idx)}
                        focusable
                        style={[
                          styles.seasonChip,
                          { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                          active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
                        ]}
                      >
                        <Text style={[
                          styles.seasonChipText,
                          { color: active ? colors.onBrandPrimary : colors.onSurface }
                        ]}>Sezon {s.season}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {seasons[selectedSeasonIdx]?.episodes.map((ep: any) => (
                  <TouchableOpacity
                    key={ep.id}
                    testID={`episode-${ep.id}-btn`}
                    onPress={() => handlePlayEpisode(ep)}
                    activeOpacity={0.75}
                    focusable
                    style={[styles.epRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  >
                    <View style={[styles.epNum, { backgroundColor: colors.surfaceTertiary }]}>
                      <Text style={[styles.epNumText, { color: colors.onSurface }]}>{ep.episode_num}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.epTitle, { color: colors.onSurface }]} numberOfLines={1}>{ep.title}</Text>
                      {ep.plot ? <Text style={[styles.epPlot, { color: colors.onSurfaceSecondary }]} numberOfLines={2}>{ep.plot}</Text> : null}
                    </View>
                    <Ionicons name="play-circle" size={26} color={colors.brandPrimary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {error && <Text style={{ color: colors.error, marginTop: SPACING.md }}>{error}</Text>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: SPACING.sm }}>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 1 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: colors.onSurface, fontSize: FONT.size.base, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

const HERO_H = 340;
const POSTER_W = 110;
const POSTER_H = 165;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  heroWrap: { height: HERO_H, position: "relative" },
  heroImg: { width: "100%", height: "100%" },
  heroSafe: { position: "absolute", top: 0, left: 0, right: 0 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center",
    marginLeft: SPACING.md, marginTop: SPACING.sm,
  },
  heroContent: {
    position: "absolute",
    bottom: SPACING.lg,
    left: SPACING.lg, right: SPACING.lg,
    flexDirection: "row",
    gap: SPACING.lg,
  },
  posterFrame: {
    width: POSTER_W, height: POSTER_H,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.15)",
  },
  posterImg: { width: "100%", height: "100%" },
  heroInfo: { flex: 1, justifyContent: "flex-end" },
  title: { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, lineHeight: 28 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: SPACING.sm },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: RADIUS.sm, backgroundColor: "rgba(255,255,255,0.12)",
  },
  metaText: { color: "#fff", fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  playBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    height: 52, borderRadius: RADIUS.pill,
  },
  playBtnText: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
  iconAction: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 52, borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: SPACING.md, minWidth: 52,
  },
  sectionTitle: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 1.5, marginBottom: SPACING.sm },
  plotText: { fontSize: FONT.size.base, lineHeight: 22 },
  detailsGrid: { marginTop: SPACING.lg },
  seasonChip: {
    height: 36, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill, borderWidth: 1,
    justifyContent: "center", flexShrink: 0,
  },
  seasonChipText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  epRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  epNum: {
    width: 40, height: 40, borderRadius: RADIUS.sm,
    alignItems: "center", justifyContent: "center",
  },
  epNumText: { fontSize: FONT.size.base, fontWeight: FONT.weight.black },
  epTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
  epPlot: { fontSize: FONT.size.sm, marginTop: 2 },
});
