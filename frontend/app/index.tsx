import { useEffect } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { storage } from "@/src/utils/storage";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing, withDelay,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { usePlaylists } from "@/src/store/PlaylistContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { useProfiles } from "@/src/store/ProfileContext";
import { KizilkanLogo } from "@/src/components/KizilkanLogo";

export default function Index() {
  const router = useRouter();
  const { isLoading, playlists } = usePlaylists();
  const { colors, isLoading: themeLoading } = useTheme();
  const { profiles, isLoading: profilesLoading } = useProfiles();

  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0);
  const barWidth = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.6)) });
    opacity.value = withTiming(1, { duration: 600 });
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    barWidth.value = withDelay(400, withTiming(1, { duration: 1200 }));
  }, [scale, opacity, glow, barWidth]);

  useEffect(() => {
    if (isLoading || themeLoading || profilesLoading) return;
    const t = setTimeout(async () => {
      /**
       * TEK YÖNLENDİRİCİ (v6.0.0) — akış baştan tutarlı kuruldu.
       *
       * Eski akışta profile-setup / onboarding / add-playlist gevşek bağlıydı
       * ve profilsiz duruma düşülebiliyordu. Artık TEK kural var:
       *
       *   Hiç profil yok           -> Karşılama sihirbazı (profil + liste)
       *   Profil var, liste yok    -> Liste ekleme
       *   Profil var, liste var    -> Profil seçme (Netflix mantığı)
       *
       * "İstediğin kadar profil" korunuyor: sihirbaz yalnızca İLK profili
       * oluşturur; sonrasında profil-seçme ekranından sınırsız profil eklenir.
       */
      const hasProfile = profiles.length > 0;
      const hasPlaylist = playlists.length > 0;

      if (!hasProfile) {
        // Uygulama ilk kez açılıyor (veya profiller sıfırlandı).
        router.replace("/welcome");
      } else if (!hasPlaylist) {
        // Profil var ama hiç liste yok -> liste ekleme adımı.
        router.replace("/onboarding");
      } else {
        // Her şey hazır -> "Kim izliyor?" ekranı.
        router.replace("/profile-select");
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [isLoading, themeLoading, profilesLoading, profiles.length, playlists.length, router]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.85,
    transform: [{ scale: 0.9 + glow.value * 0.4 }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%`,
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]} testID="root-loader">
      {/* Ambient background glow */}
      <Animated.View style={[styles.ambient, glowStyle]} pointerEvents="none">
        <LinearGradient
          colors={[colors.brandPrimary + "40", "transparent"]}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={logoStyle}>
        <KizilkanLogo size={Platform.OS === "web" ? "lg" : "xl"} showSubtitle showIcon align="center" />
      </Animated.View>

      {/* Neon loading bar */}
      <View style={[styles.barBg, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <Animated.View style={[styles.barFill, { backgroundColor: colors.brandPrimary }, barStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 40 },
  ambient: {
    position: "absolute",
    width: 380, height: 380,
    borderRadius: 190,
    top: "35%",
    left: "50%",
    marginLeft: -190,
    marginTop: -190,
    overflow: "hidden",
  },
  barBg: {
    width: 220, height: 4, borderRadius: 2,
    overflow: "hidden", borderWidth: 1,
  },
  barFill: {
    height: "100%",
  },
});
