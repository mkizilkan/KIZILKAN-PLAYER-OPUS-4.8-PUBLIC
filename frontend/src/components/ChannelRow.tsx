import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { SPACING, RADIUS, FONT } from "@/src/theme/themes";
import { useTVFocus, rowFocusStyle } from "@/src/hooks/useTVFocus";
import { useTv } from "@/src/store/TvContext";
import { haptic } from "@/src/utils/haptic";
import type { Channel, NowNext } from "@/src/types";

interface Props {
  channel: Channel;
  onPress: () => void;
  onToggleFavorite?: () => void;
  onLongPress?: () => void;
  /** TV: bu satır odaklandığında (listeyi kaydırmak için). */
  onFocusItem?: () => void;
  /** TV: SOL tuşuna basılınca (listeden çıkış — kategori paneli). */
  onExitLeft?: () => void;
  /** TV: SAĞ tuşuna basılınca (listeden çıkış — üst araç çubuğu). */
  onExitRight?: () => void;
  isFavorite?: boolean;
  epg?: NowNext | null;
}

function timeRange(start?: string, stop?: string) {
  if (!start || !stop) return "";
  try {
    const s = new Date(start);
    const e = new Date(stop);
    const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${fmt(s)} - ${fmt(e)}`;
  } catch { return ""; }
}

function progress(start?: string, stop?: string) {
  if (!start || !stop) return 0;
  try {
    const s = new Date(start).getTime();
    const e = new Date(stop).getTime();
    const n = Date.now();
    if (n <= s) return 0;
    if (n >= e) return 1;
    return (n - s) / (e - s);
  } catch { return 0; }
}

export function ChannelRow({ channel, onPress, onToggleFavorite, onLongPress, onFocusItem, onExitLeft, onExitRight, isFavorite, epg }: Props) {
  const { colors } = useTheme();
  const { isFocused, onFocus, onBlur } = useTVFocus();
  const { isTv: isTvLayout } = useTv();
  const now = epg?.now;
  const next = epg?.next;
  const pct = progress(now?.start, now?.stop);

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress ? () => { haptic.medium(); onLongPress(); } : undefined}
      delayLongPress={400}
      onFocus={() => { onFocus(); onFocusItem?.(); }}
      onBlur={onBlur}
      focusable
      activeOpacity={0.7}
      testID={`channel-row-${channel.id}`}
      style={[
        styles.row,
        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
        // TV'de daha kompakt: ekrana daha çok kanal sığsın (v7.4.0)
        isTvLayout && { paddingVertical: SPACING.sm, marginBottom: SPACING.xs },
        rowFocusStyle(colors.brandPrimary, isFocused, RADIUS.md),
      ]}
    >
      <View style={[styles.logoWrap, { backgroundColor: colors.surfaceTertiary }]}>
        {channel.logo ? (
          <Image source={{ uri: channel.logo }} style={styles.logo} resizeMode="contain" />
        ) : (
          <Ionicons name="tv-outline" size={22} color={colors.onSurfaceSecondary} />
        )}
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>{channel.name}</Text>
        {now ? (
          <>
            <Text style={[styles.epgNow, { color: colors.onSurfaceSecondary }]} numberOfLines={1}>
              <Text style={{ color: colors.brandPrimary, fontWeight: FONT.weight.bold }}>ŞİMDİ • </Text>
              {now.title}
            </Text>
            <View style={[styles.progressBg, { backgroundColor: colors.surfaceTertiary }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.brandPrimary, width: `${pct * 100}%` }]} />
            </View>
            {next && (
              <Text style={[styles.epgNext, { color: colors.onSurfaceTertiary }]} numberOfLines={1}>
                Sıradaki: {next.title} • {timeRange(next.start, next.stop)}
              </Text>
            )}
          </>
        ) : (
          <Text style={[styles.groupText, { color: colors.onSurfaceTertiary }]} numberOfLines={1}>
            {channel.group || "Kanal"}
          </Text>
        )}
      </View>

      {onToggleFavorite && (
        <TouchableOpacity
          onPress={() => { haptic.soft(); onToggleFavorite(); }}
          hitSlop={12}
          testID={`fav-toggle-${channel.id}`}
          /**
           * TV ODAK DÜZELTMESİ (v7.4.0) — KRİTİK
           * SORUN: Kalp düğmesi de odaklanabilir olduğu için, kumandayla
           * satıra gelindiğinde odak SATIRA değil KALBE düşüyordu. OK tuşuna
           * basınca kanal açılmıyor, favori işaretleniyordu.
           * ÇÖZÜM: TV'de kalp odak alamaz; satırın tamamı tek hedef olur.
           * Favorilere ekleme TV'de uzun-bas menüsünden yapılır.
           * Telefonda dokunma normal çalışmaya devam eder.
           */
          focusable={!isTvLayout}
          importantForAccessibility={isTvLayout ? "no-hide-descendants" : "auto"}
          style={styles.favBtn}
        >
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={22}
            color={isFavorite ? colors.brandPrimary : colors.onSurfaceSecondary}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: "100%", height: "100%" },
  info: { flex: 1, gap: 4 },
  name: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
  epgNow: { fontSize: FONT.size.sm },
  epgNext: { fontSize: FONT.size.xs, marginTop: 2 },
  groupText: { fontSize: FONT.size.sm },
  progressBg: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 2,
  },
  progressFill: { height: "100%", borderRadius: 2 },
  favBtn: { padding: SPACING.xs },
});
