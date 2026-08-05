/**
 * KIZILKAN PLAYER — İlk açılış cihaz düzeni seçimi
 * Sürüm: v9.6.0
 * Kullanıcı TV Box / Telefon / Otomatik seçimini kendisi yapar.
 */
import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { useTv } from "@/src/store/TvContext";
import { FocusButton } from "@/src/components/FocusButton";
import { storage } from "@/src/utils/storage";
import type { TvMode } from "@/src/utils/tv";

export const DEVICE_MODE_CHOSEN_KEY = "kizilkan.deviceModeChosen.v1";

export default function DeviceModeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { setMode, setTvLayout } = useTv();
  const [saving, setSaving] = useState(false);

  const choose = async (mode: TvMode) => {
    if (saving) return;
    setSaving(true);
    try {
      await setMode(mode);
      if (mode === "on") await setTvLayout("tivimate");
      await storage.setItem(DEVICE_MODE_CHOSEN_KEY, "1");
      router.replace("/");
    } finally {
      setSaving(false);
    }
  };

  const options = [
    { mode: "on" as TvMode, icon: "tv", title: "TV Box / Android TV", text: "Kumanda, yatay ekran ve TiviMate tarzı TV arayüzü" },
    { mode: "off" as TvMode, icon: "phone-portrait", title: "Telefon / Tablet", text: "Dokunmatik kullanım için klasik mobil arayüz" },
    { mode: "auto" as TvMode, icon: "hardware-chip", title: "Otomatik Algıla", text: "Cihazın Android TV bildirimine göre karar ver" },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]}>
      <View style={styles.card}>
        <Text style={[styles.logo, { color: colors.brandPrimary }]}>KIZILKAN PLAYER</Text>
        <Text style={[styles.title, { color: colors.onSurface }]}>Bu cihazı nasıl kullanacaksınız?</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceSecondary }]}>Bu seçim daha sonra Ayarlar → TV Modu bölümünden değiştirilebilir.</Text>
        {options.map((o, index) => (
          <FocusButton
            key={o.mode}
            autoFocus={index === 0}
            onPress={() => choose(o.mode)}
            focusRadius={14}
            style={[styles.option, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Ionicons name={o.icon as any} size={34} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: colors.onSurface }]}>{o.title}</Text>
              <Text style={{ color: colors.onSurfaceSecondary }}>{o.text}</Text>
            </View>
          </FocusButton>
        ))}
        {saving ? <ActivityIndicator color={colors.brandPrimary} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 760, gap: 16 },
  logo: { textAlign: "center", fontSize: 20, fontWeight: "900", letterSpacing: 4 },
  title: { textAlign: "center", fontSize: 28, fontWeight: "900", marginTop: 8 },
  subtitle: { textAlign: "center", fontSize: 15, marginBottom: 12 },
  option: { minHeight: 86, borderWidth: 1, borderRadius: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 18 },
  optionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
});
