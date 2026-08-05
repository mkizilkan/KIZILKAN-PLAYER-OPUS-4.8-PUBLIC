/**
 * KIZILKAN PLAYER — TiviMate tarzı program bilgi paneli
 * Sürüm: v9.6.0
 */
import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONT, RADIUS, SPACING } from "@/src/theme/themes";

type Program = { title?: string; description?: string; start?: string; stop?: string };

function timeLabel(value?: string) {
  if (!value) return "--:--";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function TvProgramPanel({ channel, epg, preview = true }: { channel: any; epg?: { now?: Program; next?: Program }; preview?: boolean }) {
  const { colors } = useTheme();
  const progress = useMemo(() => {
    const start = new Date(epg?.now?.start || "").getTime();
    const stop = new Date(epg?.now?.stop || "").getTime();
    if (!Number.isFinite(start) || !Number.isFinite(stop) || stop <= start) return 0;
    return Math.max(0, Math.min(1, (Date.now() - start) / (stop - start)));
  }, [epg?.now?.start, epg?.now?.stop]);

  return (
    <View style={[styles.root, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
      {preview ? (
        <View style={styles.preview}>
          {channel?.logo || channel?.poster ? (
            <Image source={{ uri: channel.logo || channel.poster }} resizeMode="contain" style={styles.logo} />
          ) : (
            <Ionicons name="tv-outline" size={54} color={colors.onSurfaceTertiary} />
          )}
        </View>
      ) : null}

      <View style={styles.content}>
        <Text style={[styles.channel, { color: colors.onSurface }]} numberOfLines={1}>{channel?.name || "Kanal seçin"}</Text>
        <Text style={[styles.title, { color: colors.brandPrimary }]} numberOfLines={2}>{epg?.now?.title || "Program bilgisi yok"}</Text>
        <Text style={[styles.time, { color: colors.onSurfaceSecondary }]}>
          {timeLabel(epg?.now?.start)} – {timeLabel(epg?.now?.stop)}
        </Text>
        <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.brandPrimary }]} />
        </View>
        <Text style={[styles.description, { color: colors.onSurfaceSecondary }]} numberOfLines={4}>
          {epg?.now?.description || "Bu yayın için ayrıntılı program açıklaması bulunmuyor."}
        </Text>
        <View style={[styles.next, { borderTopColor: colors.border }]}>
          <Text style={[styles.nextLabel, { color: colors.onSurfaceTertiary }]}>SIRADAKİ</Text>
          <Text style={{ color: colors.onSurface }} numberOfLines={2}>{epg?.next?.title || "Bilgi yok"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, overflow: "hidden" },
  preview: { aspectRatio: 16 / 9, backgroundColor: "#050505", alignItems: "center", justifyContent: "center" },
  logo: { width: "55%", height: "55%" },
  content: { padding: SPACING.md, gap: 7 },
  channel: { fontSize: FONT.size.lg, fontWeight: "900" },
  title: { fontSize: FONT.size.base, fontWeight: "800" },
  time: { fontSize: FONT.size.xs },
  track: { height: 5, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%" },
  description: { fontSize: FONT.size.sm, lineHeight: 19 },
  next: { borderTopWidth: 1, paddingTop: SPACING.sm, marginTop: 4, gap: 4 },
  nextLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
});
