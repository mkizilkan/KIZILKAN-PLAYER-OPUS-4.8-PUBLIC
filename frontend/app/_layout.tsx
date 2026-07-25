/**
 * KIZILKAN PLAYER — Kök Yerleşim (Root Layout)
 * Dosya   : frontend/app/_layout.tsx
 * Sürüm   : v4.3.0  (önceki: v4.2.0)
 * Faz     : FAZ A / Madde 5
 *
 * ---------------------------------------------------------------------------
 * BU SÜRÜMDE NE DEĞİŞTİ
 * ---------------------------------------------------------------------------
 * [+] ErrorBoundary eklendi — tüm ağacın EN DIŞINDA. Render hatası artık
 *     beyaz ekran yerine Türkçe, aksiyon alınabilir bir ekran gösteriyor.
 * [-] LogBox.ignoreAllLogs(true) KALDIRILDI. Bu satır tüm sarı uyarıları ve
 *     hata kutularını bastırıyordu; gerçek sorunlar görünmez hale geliyordu.
 * [~] SplashScreen.preventAutoHideAsync() artık .catch() ile korunuyor
 *     (yakalanmamış promise reddi uyarısını engeller).
 * [~] Bildirim izni için kurulan setTimeout artık temizleniyor (memory leak
 *     ve unmount sonrası state güncellemesi riski kaldırıldı).
 * [+] "+not-found" rotası Stack'e kaydedildi.
 *
 * KORUNANLAR (hiçbiri değişmedi):
 *   - 8 Provider'ın tamamı ve İÇ İÇE GEÇME SIRASI birebir aynı
 *   - 21 Stack.Screen kaydının tamamı, aynı sırayla, aynı options ile
 *   - useIconFonts yükleme mantığı ve erken return davranışı
 *   - registerQuickActions + requestBaselinePermissions (3 sn gecikme dahil)
 *   - StatusBar style="light", screenOptions headerShown:false / animation:"fade"
 * ---------------------------------------------------------------------------
 */

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";
import { ThemeProvider } from "@/src/theme/ThemeContext";
import { ProfileProvider } from "@/src/store/ProfileContext";
import { PlaylistProvider } from "@/src/store/PlaylistContext";
import { ParentalProvider } from "@/src/store/ParentalContext";
import { LibraryProvider } from "@/src/store/LibraryContext";
import { DownloadProvider } from "@/src/store/DownloadContext";
import { registerQuickActions } from "@/src/utils/quickActions";
import { requestBaselinePermissions } from "@/src/utils/permissions";

// Açılış ekranı, fontlar hazır olana kadar ekranda kalsın.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* bazı platformlarda çağrı zaten yapılmış olabilir — yoksayılabilir */
});

/** Bildirim izni istemeden önce beklenen süre (kullanıcı splash'i görsün). */
const PERMISSION_PROMPT_DELAY_MS = 3000;

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (!loaded && !error) return;

    SplashScreen.hideAsync().catch(() => {});
    registerQuickActions();

    // Kullanıcıya splash'i görecek kadar zaman tanıyıp izni nazikçe iste.
    const timer = setTimeout(() => {
      requestBaselinePermissions().catch(() => {});
    }, PERMISSION_PROMPT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <ProfileProvider>
              <PlaylistProvider>
                <ParentalProvider>
                  <LibraryProvider>
                    <DownloadProvider>
                      <StatusBar style="light" />
                      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="onboarding" />
                        <Stack.Screen name="profile-select" />
                        <Stack.Screen name="playlist-select" />
                        <Stack.Screen name="pin-entry" options={{ presentation: "modal", animation: "fade" }} />
                        <Stack.Screen name="add-playlist" options={{ presentation: "modal" }} />
                        <Stack.Screen name="edit-playlist" options={{ presentation: "modal" }} />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="player" options={{ animation: "fade", orientation: "default" }} />
                        <Stack.Screen name="multi-view" options={{ animation: "fade", orientation: "default" }} />
                        <Stack.Screen name="detail" options={{ animation: "slide_from_right" }} />
                        <Stack.Screen name="epg" options={{ presentation: "modal" }} />
                        <Stack.Screen name="epg-timeline" options={{ orientation: "default" }} />
                        <Stack.Screen name="backup" options={{ presentation: "modal" }} />
                        <Stack.Screen name="catchup" options={{ presentation: "modal" }} />
                        <Stack.Screen name="stats" options={{ presentation: "modal" }} />
                        <Stack.Screen name="hidden-manager" options={{ presentation: "modal" }} />
                        <Stack.Screen name="hidden-pin" options={{ presentation: "modal", animation: "fade" }} />
                        <Stack.Screen name="diagnostic" options={{ presentation: "modal" }} />
                        <Stack.Screen name="downloads" options={{ presentation: "modal" }} />
                        <Stack.Screen name="+not-found" options={{ animation: "fade" }} />
                      </Stack>
                    </DownloadProvider>
                  </LibraryProvider>
                </ParentalProvider>
              </PlaylistProvider>
            </ProfileProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
