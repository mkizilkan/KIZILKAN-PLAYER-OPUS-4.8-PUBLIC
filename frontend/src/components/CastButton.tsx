/**
 * CastButton — Chromecast integration wrapper.
 * Lazy-loads react-native-google-cast — safe on Web (no-op).
 * On tap: casts the current source URL to the connected Chromecast device.
 */
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONT } from "@/src/theme/themes";
import { haptic } from "@/src/utils/haptic";
import { GoogleCast } from "@/src/native/cast";

interface CastButtonProps {
  source?: { url: string; name: string; poster?: string | null; contentType?: string };
  size?: number;
  color?: string;
  testID?: string;
}

export function CastButton({ source, size = 24, color, testID = "cast-btn" }: CastButtonProps) {
  const { colors } = useTheme();
  const [castState, setCastState] = useState<string>("NoDevicesAvailable"); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!GoogleCast || Platform.OS === "web") return;
    let sub: any = null;
    try {
      const sessionManager = GoogleCast.getSessionManager?.();
      sub = sessionManager?.onSessionStarted?.(() => setConnected(true));
      // Some versions expose CastContext.getCurrentCastState
      const context = GoogleCast.CastContext || GoogleCast;
      context.getCastState?.().then((s: any) => setCastState(String(s || "")));
      context.onCastStateChanged?.((s: any) => {
        setCastState(String(s || ""));
        setConnected(String(s || "").toLowerCase().includes("connected"));
      });
    } catch { /* ignore */ }
    return () => { try { sub?.remove?.(); } catch {} };
  }, []);

  const cast = async () => {
    haptic.medium();
    if (!GoogleCast || Platform.OS === "web") {
      Alert.alert(
        "Chromecast",
        "Chromecast özelliği yalnızca native uygulamada (APK/IPA) çalışır. Publish edip yeni build oluşturmanız gerekir.",
      );
      return;
    }
    if (!source?.url) {
      Alert.alert("Cast", "Yayınlanacak içerik yok.");
      return;
    }
    try {
      // Show device picker
      const context = GoogleCast.CastContext || GoogleCast;
      await context.showCastDialog?.();
      // If already connected, load media
      const client = GoogleCast.getSessionManager?.()?.getCurrentSession?.()?.getMediaClient?.();
      if (client) {
        await client.loadMedia({
          mediaInfo: {
            contentUrl: source.url,
            contentType: source.contentType || guessMime(source.url),
            metadata: {
              type: "generic",
              title: source.name,
              images: source.poster ? [{ url: source.poster }] : [],
            },
          },
          autoplay: true,
        });
      }
    } catch (e: any) {
      Alert.alert("Cast Hatası", String(e?.message || e));
    }
  };

  const iconColor = color || (connected ? colors.brandPrimary : colors.onSurface);
  const showBadge = connected;

  return (
    <TouchableOpacity testID={testID} onPress={cast} hitSlop={10} style={styles.wrap}>
      <Ionicons name={connected ? "wifi" : "tv-outline"} size={size} color={iconColor} />
      {showBadge && (
        <View style={[styles.badge, { backgroundColor: colors.brandPrimary }]}>
          <Text style={styles.badgeText}>ON</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function guessMime(url: string): string {
  const ext = (url.split(".").pop() || "").split("?")[0].toLowerCase();
  const map: Record<string, string> = {
    mp4: "video/mp4", m4v: "video/mp4", mov: "video/mp4",
    mkv: "video/x-matroska",
    m3u8: "application/x-mpegurl", ts: "video/mp2t",
    mpd: "application/dash+xml",
    webm: "video/webm",
    avi: "video/x-msvideo",
  };
  return map[ext] || "video/mp4";
}

const styles = StyleSheet.create({
  wrap: { padding: 4 },
  badge: {
    position: "absolute", top: -2, right: -2,
    paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6,
  },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: FONT.weight.black },
});
