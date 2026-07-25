import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { SPACING, RADIUS, FONT } from "@/src/theme/themes";
import { usePlaylists } from "@/src/store/PlaylistContext";
import { useProfiles } from "@/src/store/ProfileContext";
import { KizilkanLogo } from "@/src/components/KizilkanLogo";
import { haptic } from "@/src/utils/haptic";

export default function PlaylistSelect() {
  const router = useRouter();
  const { colors } = useTheme();
  const { playlists, activePlaylist, setActivePlaylist, isLoading } = usePlaylists();
  const { activeProfile } = useProfiles();
  const [autoTimer, setAutoTimer] = useState(4);

  const sorted = useMemo(() => {
    // last-used first
    if (!playlists?.length) return [];
    const copy = [...playlists];
    copy.sort((a, b) => {
      if (activePlaylist?.id === a.id) return -1;
      if (activePlaylist?.id === b.id) return 1;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
    return copy;
  }, [playlists, activePlaylist]);

  // Auto-continue with the last-used playlist if user is idle (single-playlist / TV Box friendly)
  useEffect(() => {
    if (isLoading) return;
    if (sorted.length === 0) {
      router.replace("/add-playlist");
      return;
    }
    if (sorted.length === 1) {
      // fast path — one playlist, just go in
      const only = sorted[0];
      (async () => {
        if (activePlaylist?.id !== only.id) await setActivePlaylist(only.id);
        router.replace("/(tabs)");
      })();
      return;
    }
    // multiple playlists → countdown auto-continue to last-used
    const interval = setInterval(() => setAutoTimer(t => Math.max(0, t - 1)), 1000);
    const timer = setTimeout(async () => {
      const last = sorted[0];
      if (activePlaylist?.id !== last.id) await setActivePlaylist(last.id);
      router.replace("/(tabs)");
    }, 4000);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [isLoading, sorted, activePlaylist?.id, router, setActivePlaylist]);

  const cancelAuto = () => setAutoTimer(-1);

  const choose = async (id: string) => {
    haptic.medium();
    if (activePlaylist?.id !== id) await setActivePlaylist(id);
    router.replace("/(tabs)");
  };

  const sourceIcon = (source?: string) => {
    if (source === "xtream") return "server";
    if (source === "stalker") return "hardware-chip";
    if (source === "m3u_url") return "link";
    return "document-attach";
  };
  const sourceLabel = (source?: string) => {
    if (source === "xtream") return "Xtream Codes";
    if (source === "stalker") return "MAG / Stalker";
    if (source === "m3u_url") return "M3U URL";
    return "M3U Dosya";
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]} testID="playlist-select-screen">
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <KizilkanLogo size="md" showSubtitle={false} showIcon align="center" />
            <Text style={[styles.hello, { color: colors.onSurfaceSecondary }]}>
              Merhaba <Text style={{ color: colors.onSurface, fontWeight: FONT.weight.bold }}>{activeProfile.name}</Text>
            </Text>
            <Text style={[styles.title, { color: colors.onSurface }]}>Hangi liste ile başlayalım?</Text>
            {autoTimer > 0 && sorted.length > 1 && (
              <TouchableOpacity testID="cancel-auto-btn" onPress={cancelAuto} style={{ marginTop: SPACING.sm }}>
                <Text style={[styles.autoText, { color: colors.brandPrimary }]}>
                  {autoTimer}s içinde son liste otomatik açılacak (Dokun: durdur)
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {sorted.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                testID={`playlist-cell-${p.id}`}
                onPress={() => choose(p.id)}
                onFocus={cancelAuto}
                activeOpacity={0.85}
                focusable
                hasTVPreferredFocus={i === 0}
                style={[
                  styles.cell,
                  { backgroundColor: colors.surfaceSecondary, borderColor: activePlaylist?.id === p.id ? colors.brandPrimary : colors.border },
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.brandPrimary + "22" }]}>
                  <Ionicons name={sourceIcon(p.source) as any} size={28} color={colors.brandPrimary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>
                    {p.name}
                    {activePlaylist?.id === p.id && (
                      <Text style={{ color: colors.brandPrimary, fontSize: FONT.size.xs }}>  •  SON</Text>
                    )}
                  </Text>
                  <Text style={[styles.sub, { color: colors.onSurfaceSecondary }]} numberOfLines={1}>
                    {sourceLabel(p.source)} • {p.channels?.length || 0} kanal
                    {p.vod?.length ? ` • ${p.vod.length} film` : ""}
                    {p.series?.length ? ` • ${p.series.length} dizi` : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.onSurfaceTertiary} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              testID="add-new-playlist-btn"
              onPress={() => router.push("/add-playlist")}
              activeOpacity={0.85}
              focusable
              style={[styles.cell, styles.addCell, { borderColor: colors.border }]}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
                <Ionicons name="add" size={28} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.brandPrimary }]}>Yeni Liste Ekle</Text>
                <Text style={[styles.sub, { color: colors.onSurfaceSecondary }]}>M3U / Xtream Codes / MAG</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.brandPrimary} />
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              testID="switch-profile-link"
              onPress={() => router.replace("/profile-select")}
              hitSlop={10}
            >
              <Text style={[styles.footerText, { color: colors.onSurfaceSecondary }]}>
                <Ionicons name="person-circle-outline" size={14} color={colors.onSurfaceSecondary} />{" "}
                Profil değiştir
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { alignItems: "center", paddingTop: SPACING.xl, paddingHorizontal: SPACING.xl, gap: 4 },
  hello: { fontSize: FONT.size.sm, marginTop: SPACING.lg },
  title: { fontSize: 22, fontWeight: FONT.weight.black, marginTop: SPACING.sm, textAlign: "center" },
  autoText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold, textAlign: "center" },
  list: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xxxl },
  cell: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5,
  },
  addCell: { borderStyle: "dashed", borderWidth: 2, marginTop: SPACING.sm },
  iconBox: { width: 56, height: 56, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  name: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
  sub: { fontSize: FONT.size.xs, marginTop: 2 },
  footer: { alignItems: "center", padding: SPACING.md },
  footerText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
});
