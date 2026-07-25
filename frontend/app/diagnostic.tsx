import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { SPACING, RADIUS, FONT } from "@/src/theme/themes";
import { forceResolveBackend, getConfiguredBackends, getActiveBackend } from "@/src/utils/api";
import { haptic } from "@/src/utils/haptic";
import * as Clipboard from "expo-clipboard";

interface TestResult { url: string; ok: boolean; ms?: number }

export default function DiagnosticScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [active, setActive] = useState<string | null>(getActiveBackend());

  const runTest = async () => {
    haptic.medium();
    setTesting(true);
    setResults([]);
    const backends = getConfiguredBackends();
    const initial: TestResult[] = backends.map(url => ({ url, ok: false }));
    setResults(initial);
    const t0 = Date.now();
    const r = await forceResolveBackend();
    const elapsed = Date.now() - t0;
    setResults(r.tested.map(x => ({ ...x, ms: x.ok ? elapsed : undefined })));
    setActive(r.active);
    setTesting(false);
    if (r.ok) haptic.success(); else haptic.error();
  };

  useEffect(() => {
    runTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyToClipboard = async (text: string) => {
    try { await Clipboard.setStringAsync(text); haptic.success(); Alert.alert("Kopyalandı", text); } catch {}
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]} testID="diagnostic-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="diag-back-btn" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.onSurface }]}>Bağlantı Testi</Text>
        <TouchableOpacity
          testID="diag-retest-btn"
          onPress={runTest}
          hitSlop={12}
          disabled={testing}
          style={styles.iconBtn}
        >
          <Ionicons name="refresh" size={22} color={testing ? colors.onSurfaceTertiary : colors.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxxl, gap: SPACING.md }}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <View style={[styles.statusDot, { backgroundColor: active ? "#00C853" : "#E53935" }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryTitle, { color: colors.onSurface }]}>
              {testing ? "Test ediliyor..." : active ? "Bağlantı Sağlandı" : "Bağlanılamadı"}
            </Text>
            {active && (
              <Text style={[styles.summarySub, { color: colors.onSurfaceSecondary }]} numberOfLines={1}>
                Aktif sunucu: {active.replace(/^https?:\/\//, "")}
              </Text>
            )}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>SUNUCU TESTLERİ</Text>

        {results.map(r => (
          <TouchableOpacity
            key={r.url}
            testID={`diag-url-${r.url}`}
            onPress={() => copyToClipboard(r.url)}
            style={[styles.urlCard, { backgroundColor: colors.surfaceSecondary, borderColor: r.ok ? "#00C853" : r.url === active ? colors.brandPrimary : colors.border }]}
            activeOpacity={0.75}
          >
            <View style={[styles.dot, { backgroundColor: r.ok ? "#00C853" : testing ? "#FFA000" : "#E53935" }]}>
              {testing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : r.ok ? (
                <Ionicons name="checkmark" size={16} color="#fff" />
              ) : (
                <Ionicons name="close" size={16} color="#fff" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.urlText, { color: colors.onSurface }]} numberOfLines={2}>
                {r.url}
              </Text>
              <Text style={[styles.urlMeta, { color: colors.onSurfaceSecondary }]}>
                {testing ? "Test ediliyor..."
                  : r.ok ? `Erişilebilir${r.ms ? ` • ${r.ms}ms` : ""}${r.url === active ? " • AKTİF" : ""}`
                  : "Erişilemedi"}
              </Text>
            </View>
            <Ionicons name="copy-outline" size={18} color={colors.onSurfaceTertiary} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          testID="diag-run-btn"
          onPress={runTest}
          disabled={testing}
          style={[styles.primaryBtn, { backgroundColor: colors.brandPrimary, opacity: testing ? 0.5 : 1 }]}
        >
          {testing ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Ionicons name="pulse" size={20} color={colors.onBrandPrimary} />
              <Text style={[styles.primaryBtnText, { color: colors.onBrandPrimary }]}>Testi Tekrarla</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={[styles.helpCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={18} color={colors.brandPrimary} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.helpTitle, { color: colors.onSurface }]}>Bağlanılamıyorsa</Text>
            <Text style={[styles.helpText, { color: colors.onSurfaceSecondary }]}>
              • İnternet bağlantınızı (Wi-Fi / mobil veri) kontrol edin.
              {"\n"}• VPN veya proxy kullanıyorsanız kapatıp deneyin.
              {"\n"}• Farklı bir ağa geçmeyi deneyin (Wi-Fi ↔ mobil veri).
              {"\n"}• Sorun devam ederse yeniden başlatın.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, flex: 1, textAlign: "center" },
  iconBtn: { padding: 4 },
  summaryCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  summaryTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  summarySub: { fontSize: FONT.size.xs, marginTop: 2 },
  sectionTitle: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 1.5, marginTop: SPACING.md },
  urlCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1,
  },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  urlText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  urlMeta: { fontSize: FONT.size.xs, marginTop: 2 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    height: 52, borderRadius: RADIUS.pill, marginTop: SPACING.md,
  },
  primaryBtnText: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  helpCard: {
    flexDirection: "row", gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, marginTop: SPACING.md,
  },
  helpTitle: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  helpText: { fontSize: FONT.size.xs, lineHeight: 18 },
});
