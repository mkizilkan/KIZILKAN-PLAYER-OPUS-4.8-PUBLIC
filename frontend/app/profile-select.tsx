import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { SPACING, RADIUS, FONT } from "@/src/theme/themes";
import { useProfiles, PROFILE_AVATAR_COLORS } from "@/src/store/ProfileContext";

export default function ProfileSelect() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profiles, activeProfile, switchProfile, addProfile, setPin, verifyPinAsync, verifyAdminPin, adminHasPin } = useProfiles();
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adminGate, setAdminGate] = useState(false);  // + için yönetici PIN ekranı
  const [adminPinInput, setAdminPinInput] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PROFILE_AVATAR_COLORS[0]);
  const [newPin, setNewPin] = useState("");   // v5.6.0: profil oluştururken PIN
  const [isKids, setIsKids] = useState(false);
  const [busy, setBusy] = useState(false);

  const initials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const handleSelect = async (pid: string) => {
    const p = profiles.find(x => x.id === pid);
    if (!p) return;
    // HER DEFASINDA PIN SOR (v5.7.0 — kullanıcı isteği)
    // ESKİ: zaten aktif olan profile girerken PIN sorulmuyordu; uygulamayı
    // kapatıp açan biri doğrudan içeri girebiliyordu.
    if (p.hasPin) {
      setPinFor(pid);
      setPinInput("");
      setPinError(null);
      return;
    }
    await switchProfile(pid);
    router.replace("/playlist-select");
  };

  const submitPin = async () => {
    if (!pinFor) return;
    if (await verifyPinAsync(pinFor, pinInput)) {
      await switchProfile(pinFor);
      router.replace("/playlist-select");
    } else {
      setPinError("Yanlış PIN");
    }
  };

  const submitNew = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    // v5.7.0: PIN artık profil oluşturulurken ATOMİK olarak veriliyor.
    const wantPin = newPin.trim();
    if (wantPin) {
      const fmt = isValidPinFormat(wantPin);
      if (!fmt.ok) {
        setBusy(false);
        Alert.alert("Geçersiz PIN", fmt.error || "PIN 4-10 rakam olmalı.");
        return;
      }
    }
    const p = await addProfile(newName, newColor, isKids, wantPin || null);
    if (wantPin) await ensureRecoveryCode();
    setNewPin("");
    await switchProfile(p.id);
    setBusy(false);
    router.replace("/playlist-select");
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} testID="profile-select-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={[styles.brand, { color: colors.brandPrimary }]}>KIZILKAN</Text>
          <Text style={[styles.title, { color: colors.onSurface }]}>Kim izliyor?</Text>
        </View>

        <ScrollView contentContainerStyle={styles.gridWrap}>
          {!showAdd && !pinFor && !adminGate && (
            <View style={styles.grid}>
              {profiles.map(p => (
                <TouchableOpacity
                  key={p.id}
                  testID={`profile-${p.id}-btn`}
                  onPress={() => handleSelect(p.id)}
                  activeOpacity={0.8}
                  focusable
                  style={styles.profileCell}
                >
                  <View style={[styles.avatar, { backgroundColor: p.color }]}>
                    <Text style={styles.avatarInitials}>{initials(p.name)}</Text>
                    {p.hasPin && (
                      <View style={[styles.pinBadge, { backgroundColor: colors.surface }]}>
                        <Ionicons name="lock-closed" size={12} color={colors.onSurface} />
                      </View>
                    )}
                    {p.isKids && (
                      <View style={[styles.kidsBadge, { backgroundColor: colors.brandPrimary }]}>
                        <Text style={styles.kidsBadgeText}>ÇOCUK</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.profileName, { color: colors.onSurface }]} numberOfLines={1}>{p.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                testID="add-profile-btn"
                onPress={() => {
                  // v6.1.0 (Seçenek C): Profil ekleme YÖNETİCİ PIN'i ister.
                  // Yöneticinin PIN'i yoksa koruma yok -> doğrudan ekleme formu.
                  if (adminHasPin()) {
                    setAdminPinInput("");
                    setAdminError(null);
                    setAdminGate(true);
                  } else {
                    setShowAdd(true);
                  }
                }}
                activeOpacity={0.8}
                focusable
                style={styles.profileCell}
              >
                <View style={[styles.avatarAdd, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                  <Ionicons name="add" size={40} color={colors.onSurfaceSecondary} />
                </View>
                <Text style={[styles.profileName, { color: colors.onSurfaceSecondary }]}>Profil Ekle</Text>
              </TouchableOpacity>
            </View>
          )}

          {showAdd && (
            <View style={styles.form}>
              <Text style={[styles.formLabel, { color: colors.onSurfaceSecondary }]}>PROFİL ADI</Text>
              <TextInput
                testID="new-profile-name-input"
                value={newName}
                onChangeText={setNewName}
                placeholder="Örn: Ali, Anne, Çocuk"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />

              <Text style={[styles.formLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>AVATAR RENGİ</Text>
              <View style={styles.colorRow}>
                {PROFILE_AVATAR_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    testID={`color-${c}-btn`}
                    onPress={() => setNewColor(c)}
                    style={[styles.colorSwatch, { backgroundColor: c, borderColor: newColor === c ? colors.onSurface : "transparent" }]}
                  />
                ))}
              </View>

              {/* PROFİL PIN'İ (v5.6.0 — eskiden bu alan hiç yoktu) */}
              <Text style={[styles.formLabel, { color: colors.onSurfaceSecondary, marginTop: SPACING.lg }]}>
                PIN (İSTEĞE BAĞLI — 4-10 RAKAM)
              </Text>
              <TextInput
                testID="new-profile-pin-input"
                value={newPin}
                onChangeText={(t) => setNewPin(t.replace(/[^0-9]/g, "").slice(0, 10))}
                placeholder="Boş bırakırsanız kilit olmaz"
                placeholderTextColor={colors.onSurfaceTertiary}
                keyboardType="number-pad"
                secureTextEntry
                style={[styles.input, { color: colors.onSurface, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
              />

              <TouchableOpacity
                testID="toggle-kids-btn"
                onPress={() => setIsKids(!isKids)}
                style={[styles.kidsToggle, { backgroundColor: colors.surfaceSecondary, borderColor: isKids ? colors.brandPrimary : colors.border }]}
              >
                <Ionicons name={isKids ? "checkbox" : "square-outline"} size={22} color={isKids ? colors.brandPrimary : colors.onSurfaceSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.kidsTitle, { color: colors.onSurface }]}>Çocuk Profili</Text>
                  <Text style={[styles.kidsSub, { color: colors.onSurfaceSecondary }]}>Sadece &quot;Ebeveyn Kontrolü&quot;nde kilitli olmayan içerikler gösterilir</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  testID="cancel-new-btn"
                  onPress={() => setShowAdd(false)}
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.cancelText, { color: colors.onSurface }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="save-new-profile-btn"
                  onPress={submitNew}
                  disabled={busy || !newName.trim()}
                  style={[styles.saveBtn, { backgroundColor: colors.brandPrimary, opacity: busy || !newName.trim() ? 0.5 : 1 }]}
                >
                  {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
                    <Text style={[styles.saveText, { color: colors.onBrandPrimary }]}>Oluştur</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {adminGate && (
            <View style={styles.form}>
              <Text style={[styles.pinTitle, { color: colors.onSurface }]}>Yönetici PIN&apos;i</Text>
              <Text style={[styles.pinSub, { color: colors.onSurfaceSecondary }]}>
                Yeni profil eklemek için yönetici (ana profil) PIN&apos;ini girin
              </Text>
              <TextInput
                testID="admin-pin-input"
                value={adminPinInput}
                onChangeText={t => { setAdminPinInput(t.replace(/\D/g, "").slice(0, 10)); setAdminError(null); }}
                placeholder="PIN (4-10 rakam)"
                placeholderTextColor={colors.onSurfaceTertiary}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={10}
                autoFocus
                style={[styles.pinInput, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              {adminError && <Text style={[styles.pinError, { color: colors.error }]}>{adminError}</Text>}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  testID="cancel-admin-btn"
                  onPress={() => { setAdminGate(false); setAdminPinInput(""); setAdminError(null); }}
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.cancelText, { color: colors.onSurface }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="submit-admin-btn"
                  onPress={async () => {
                    if (await verifyAdminPin(adminPinInput)) {
                      setAdminGate(false);
                      setAdminPinInput("");
                      setShowAdd(true);
                    } else {
                      setAdminError("Yönetici PIN'i yanlış");
                      haptic.error();
                    }
                  }}
                  disabled={adminPinInput.length < 4}
                  style={[styles.saveBtn, { backgroundColor: colors.brandPrimary, opacity: adminPinInput.length < 4 ? 0.5 : 1 }]}
                >
                  <Text style={[styles.saveText, { color: colors.onBrandPrimary }]}>Onayla</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {pinFor && (
            <View style={styles.form}>
              <Text style={[styles.pinTitle, { color: colors.onSurface }]}>PIN Girin</Text>
              <Text style={[styles.pinSub, { color: colors.onSurfaceSecondary }]}>Bu profil PIN ile korunuyor</Text>
              <TextInput
                testID="pin-input"
                value={pinInput}
                onChangeText={t => { setPinInput(t.replace(/\D/g, "").slice(0, 10)); setPinError(null); }}
                placeholder="PIN (4-10 rakam)"
                placeholderTextColor={colors.onSurfaceTertiary}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={10}
                autoFocus
                style={[styles.pinInput, { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, borderColor: colors.border }]}
              />
              {pinError && <Text style={[styles.pinError, { color: colors.error }]}>{pinError}</Text>}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  testID="cancel-pin-btn"
                  onPress={() => { setPinFor(null); setPinInput(""); setPinError(null); }}
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.cancelText, { color: colors.onSurface }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="submit-pin-btn"
                  onPress={submitPin}
                  disabled={pinInput.length < 4}
                  style={[styles.saveBtn, { backgroundColor: colors.brandPrimary, opacity: pinInput.length < 4 ? 0.5 : 1 }]}
                >
                  <Text style={[styles.saveText, { color: colors.onBrandPrimary }]}>Giriş</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { alignItems: "center", paddingTop: SPACING.xl, paddingBottom: SPACING.lg, gap: SPACING.sm },
  brand: { fontSize: FONT.size.sm, fontWeight: FONT.weight.black, letterSpacing: 4 },
  title: { fontSize: 28, fontWeight: FONT.weight.black, letterSpacing: 0.5 },
  gridWrap: { padding: SPACING.lg, alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.lg, justifyContent: "center", maxWidth: 400 },
  profileCell: { alignItems: "center", gap: SPACING.sm, width: 110 },
  avatar: {
    width: 96, height: 96, borderRadius: RADIUS.md * 1.5,
    alignItems: "center", justifyContent: "center", position: "relative",
  },
  avatarAdd: {
    width: 96, height: 96, borderRadius: RADIUS.md * 1.5,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderStyle: "dashed",
  },
  avatarInitials: { color: "#fff", fontSize: 36, fontWeight: FONT.weight.black },
  pinBadge: {
    position: "absolute", bottom: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  kidsBadge: {
    position: "absolute", top: -8, left: -8,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm,
  },
  kidsBadgeText: { color: "#fff", fontSize: 9, fontWeight: FONT.weight.black, letterSpacing: 1 },
  profileName: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, textAlign: "center" },
  form: { width: "100%", maxWidth: 360, gap: SPACING.sm },
  formLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 1.5 },
  input: {
    height: 52, borderWidth: 1, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, fontSize: FONT.size.lg,
  },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md, paddingVertical: SPACING.sm },
  colorSwatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
  kidsToggle: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5,
    marginTop: SPACING.lg,
  },
  kidsTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  kidsSub: { fontSize: FONT.size.sm, marginTop: 2, lineHeight: 16 },
  actionRow: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.xl },
  cancelBtn: {
    flex: 1, height: 52, borderRadius: RADIUS.pill, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  cancelText: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
  saveBtn: {
    flex: 1, height: 52, borderRadius: RADIUS.pill,
    alignItems: "center", justifyContent: "center",
  },
  saveText: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  pinTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, textAlign: "center", marginBottom: 4 },
  pinSub: { fontSize: FONT.size.sm, textAlign: "center", marginBottom: SPACING.xl },
  pinInput: {
    height: 64, borderWidth: 1, borderRadius: RADIUS.md,
    fontSize: 28, fontWeight: FONT.weight.black,
    letterSpacing: 12, textAlign: "center",
  },
  pinError: { fontSize: FONT.size.sm, textAlign: "center", marginTop: SPACING.sm },
});
