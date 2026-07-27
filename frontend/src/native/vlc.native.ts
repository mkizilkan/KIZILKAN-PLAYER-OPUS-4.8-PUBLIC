/**
 * KIZILKAN PLAYER — VLC Native Binding
 *
 * ADIM 1 (v4.8.0): Paket geçişi derleme testi.
 * Eski paket (react-native-vlc-media-player) KALDIRILDI.
 * Yeni paket (expo-libvlc-player) EKLENDİ ama HENÜZ BAĞLANMADI.
 *
 * Bu adımın TEK amacı: "expo-libvlc-player bu projede derleniyor mu?"
 * O yüzden burada geçici olarak null döndürüyoruz — player.tsx VLC yolunu
 * çalıştırmaz, expo-video (exo) motoruyla çalışmaya devam eder.
 *
 * ADIM 2'de: expo-libvlc-player'ın LibVlcPlayerView bileşeni buraya bağlanacak
 * ve player.tsx yeni API'ye (options/onEncounteredError/record/track seçimi)
 * taşınacak.
 */

// Adım 1: hiçbir şey bağlama — VLC yolu devre dışı, exo motoru aktif kalır.
export const VLCPlayer: any = null;
