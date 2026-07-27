/**
 * CastButton — Chromecast entegrasyonu
 * Sürüm : v2.0.0 (v4.9.0)
 *
 * ===========================================================================
 * v4.9.0'DA DÜZELTİLEN İKİ GERÇEK HATA
 * ===========================================================================
 * 1) CİHAZ LİSTESİ AÇILMIYORDU:
 *    Eski kod kendi butonundan `showCastDialog?.()` çağırıyordu. Bu çağrı bazı
 *    cihazlarda sessizce başarısız oluyordu (opsiyonel zincirleme yüzünden hata
 *    da görünmüyordu) -> kullanıcı titreşim hissediyor ama liste gelmiyordu.
 *    ÇÖZÜM: Google'ın resmi NATIVE CastButton bileşenini kullanıyoruz; cihaz
 *    seçiciyi işletim sistemi açıyor.
 *
 * 2) BAĞLANINCA İÇERİK GİTMİYORDU:
 *    Eski kod diyaloğu açtıktan HEMEN SONRA oturumu kontrol ediyordu. Kullanıcı
 *    cihazı seçene kadar oturum kurulmadığı için yükleme atlanıyordu.
 *    ÇÖZÜM: onSessionStarted dinleyicisi — oturum kurulunca medya yükleniyor.
 * ===========================================================================
 */
import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { FONT } from "@/src/theme/themes";
import { haptic } from "@/src/utils/haptic";
import { GoogleCast, NativeCastButton } from "@/src/native/cast";

interface CastSource {
  url: string;
  name: string;
  poster?: string | null;
  contentType?: string;
}

interface CastButtonProps {
  source?: CastSource;
  size?: number;
  color?: string;
  testID?: string;
}

/** Uzantıdan MIME türü tahmin eder (Chromecast contentType ister). */
function guessMime(url: string): string {
  const u = (url || "").toLowerCase().split("?")[0];
  if (u.endsWith(".m3u8")) return "application/x-mpegURL";
  if (u.endsWith(".mpd")) return "application/dash+xml";
  if (u.endsWith(".ts")) return "video/mp2t";
  if (u.endsWith(".mkv")) return "video/x-matroska";
  if (u.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

export function CastButton({ source, size = 24, color, testID = "cast-btn" }: CastButtonProps) {
  const { colors } = useTheme();
  const [connected, setConnected] = useState(false);
  // Son kaynağı ref'te tutuyoruz: oturum kurulduğunda güncel kaynağı yükleyelim.
  const sourceRef = useRef<CastSource | undefined>(source);
  useEffect(() => { sourceRef.current = source; }, [source]);

  /** Bağlı oturuma medyayı yükler. */
  const loadInto = async (session: any) => {
    const src = sourceRef.current;
    if (!session || !src?.url) return;
    try {
      const client = session.client || session.getClient?.();
      if (!client) return;
      await client.loadMedia({
        mediaInfo: {
          contentUrl: src.url,
          contentType: src.contentType || guessMime(src.url),
          metadata: {
            type: "generic",
            title: src.name,
            images: src.poster ? [{ url: src.poster }] : [],
          },
        },
        autoplay: true,
      });
      haptic.success();
    } catch (e: any) {
      Alert.alert(
        "Chromecast",
        `İçerik cihaza gönderilemedi.\n\n${String(e?.message || e)}\n\n` +
          "Not: Chromecast cihazları ham .ts canlı yayınları çoğu zaman oynatamaz; " +
          "film/dizi (mp4) ve m3u8 yayınlar daha uyumludur."
      );
    }
  };

  // Oturum olaylarını dinle: bağlanınca YÜKLE (eski kodun atladığı adım).
  useEffect(() => {
    if (!GoogleCast || Platform.OS === "web") return;
    let subStart: any = null;
    let subEnd: any = null;
    let subState: any = null;
    try {
      const sm = GoogleCast.getSessionManager?.();
      subStart = sm?.onSessionStarted?.((session: any) => {
        setConnected(true);
        loadInto(session);
      });
      subEnd = sm?.onSessionEnded?.(() => setConnected(false));
      subState = GoogleCast.onCastStateChanged?.((state: any) => {
        setConnected(String(state || "").toLowerCase().includes("connected"));
      });
      // Zaten bağlıysa mevcut oturuma yükle.
      const current = sm?.getCurrentCastSession?.() || sm?.getCurrentSession?.();
      if (current) { setConnected(true); loadInto(current); }
    } catch { /* yoksay */ }
    return () => {
      try { subStart?.remove?.(); subEnd?.remove?.(); subState?.remove?.(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iconColor = color || (connected ? colors.brandPrimary : "#fff");

  // NATIVE BUTON (tercih edilen): cihaz seçiciyi işletim sistemi açar.
  if (NativeCastButton && Platform.OS !== "web") {
    return (
      <View style={styles.wrap} testID={testID}>
        <NativeCastButton style={{ width: size + 6, height: size + 6, tintColor: iconColor }} tintColor={iconColor} />
        {connected && (
          <View style={[styles.badge, { backgroundColor: colors.brandPrimary }]}>
            <Text style={styles.badgeText}>ON</Text>
          </View>
        )}
      </View>
    );
  }

  // YEDEK: native bileşen yoksa kendi butonumuz + açık geri bildirim.
  const fallbackPress = async () => {
    haptic.medium();
    if (!GoogleCast || Platform.OS === "web") {
      Alert.alert("Chromecast", "Bu özellik yalnızca APK/IPA (native) sürümde çalışır.");
      return;
    }
    try {
      const shown = await GoogleCast.showCastDialog?.();
      if (shown === false || shown === undefined) {
        Alert.alert(
          "Chromecast",
          "Cihaz bulunamadı.\n\n• Telefon ve Chromecast AYNI Wi-Fi ağında olmalı\n" +
            "• Chromecast açık ve TV'de görünür olmalı\n" +
            "• VPN kullanıyorsanız kapatın"
        );
      }
    } catch (e: any) {
      Alert.alert("Chromecast Hatası", String(e?.message || e));
    }
  };

  return (
    <TouchableOpacity testID={testID} onPress={fallbackPress} hitSlop={10} style={styles.wrap}>
      <Ionicons name={connected ? "wifi" : "tv-outline"} size={size} color={iconColor} />
      {connected && (
        <View style={[styles.badge, { backgroundColor: colors.brandPrimary }]}>
          <Text style={styles.badgeText}>ON</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute", top: -4, right: -8,
    paddingHorizontal: 4, borderRadius: 6,
  },
  badgeText: { fontSize: 8, color: "#fff", fontWeight: FONT.weight.bold },
});

export default CastButton;
