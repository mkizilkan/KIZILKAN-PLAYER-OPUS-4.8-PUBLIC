# KIZILKAN PLAYER — SÜRÜM NOTU v9.14.0

**Sürüm:** 9.13.0 → **9.14.0**  
**Android versionCode:** 91300 → **91400**  
**Konu:** Homatics Box R 4K+ üzerinde tema rengine boyanan video/üst şerit için native video yüzeyi yaşam-döngüsü ve kompozisyon düzeltmesi

## Gerçek cihaz bulgusu

- OnePlus 7 Pro: Exo + SurfaceView görüntüsü normaldi.
- Homatics Box R 4K+: Exo + TextureView sırasında video ve üst bant seçili tema rengine (mavi/kırmızı) boyanabiliyordu.
- Birkaç zap sonrasında görüntünün düzelmesi, statik safe-area/tema View probleminden çok native video surface attach/reuse ve kompozisyon yaşam döngüsünü işaret etti.
- v9.13.0 DEBUG_STRIP görüntülerinde safe-top 0 px idi; geniş renkli bant debug cyan bandı değildi.

## v9.14.0 değişiklikleri

1. `VideoView` ve VLC native görünümü `GestureDetector > Animated.View` ağacından çıkarıldı.
2. Native video için tamamen opak siyah, bağımsız `nativeVideoStage` eklendi.
3. Gesture yakalayıcı video sahnesinden ayrılıp şeffaf sibling katman oldu; tema rengi taşımaz.
4. TV `auto` yüzey politikası `SurfaceView` birincil olacak şekilde değiştirildi. Bu, Expo SDK 54 `expo-video` API'sinin Android için önerdiği ana yoldur.
5. SurfaceView decoder hatası verirse yalnız ilgili kanal için TextureView yedeğine geçilir; TextureView da hata verirse mevcut VLC fallback korunur.
6. SurfaceView `readyToPlay` olduktan sonra 5 saniye içinde ilk video karesi render edilmezse eski “ses var / görüntü yok” sınıfını korumak için TextureView'a otomatik fallback yapılır.
7. `VideoView` key'i kanal + yüzey + generation ile güçlendirildi; zap/yüzey değişiminde eski native surface yeniden kullanılmaz.
8. `useExoShutter` etkinleştirildi; ilk kare gelene kadar ExoPlayer siyah shutter ile alt katmanı kapatır.
9. `onFirstFrameRender` resmi callback'i kullanılarak ilk kare durumu gerçek native olaydan izlenir.
10. Kullanıcının manuel `auto / surface / texture` seçimi kaldırılmadı; aynen korunur.
11. v9.13.0 geçici `DEBUG_STRIP` katmanı üretim player'ından kaldırıldı.
12. Player'ın kayıt, ses/alaztyazı, hız, fit, zap, catch-up, VLC fallback, kumanda ve kontrol paneli işlevleri korunmuştur.

## Doğrulama

- `node ../tools/denetle.js`: **8/8 temiz**.
- TypeScript 5.8.3 ile 87 TS/TSX dosyası parse/transpile sözdizimi kontrolü: **0 hata**.
- `app.json` ve `package.json` JSON parse: temiz.
- GitHub Actions YAML parse: temiz.
- Sürüm üç alanda doğrulandı: `version=9.14.0`, `buildNumber=9.14.0`, `versionCode=91400`.
- `DEBUG_STRIP`, `setDecoderRetrySurface`, `decoderRetrySurface` aktif kaynakta bulunmuyor.

## Bilinen doğrulama sınırı

Bu çalışma ortamında proje bağımlılıklarının tamamı kurulu olmadığı için tam `npx tsc --noEmit` + Expo prebuild + Gradle APK derlemesi yerelde yapılamadı. `typescript@5.7.3` npm kurulumu ağ zaman aşımına uğradı; ortamda mevcut TypeScript 5.8.3 ile taşınabilir denetleyiciler ve sözdizimi kontrolü çalıştırıldı. GitHub Actions bağımlılıkları kurduktan sonra denetleyici, tsc raporu, prebuild ve Gradle derlemesini gerçek CI ortamında çalıştıracaktır.

## Gerçek cihaz test sırası

1. Homatics Box R 4K+ → modern mavi tema → sorunlu 4K kanal.
2. Aynı kanal → kırmızı tema.
3. `Video yüzeyi: Otomatik` ile ilk açılış ve en az 10 zap.
4. Manuel SurfaceView ve TextureView karşılaştırması.
5. TRT1 gibi normal H.264 kanal ile regresyon kontrolü.
6. Exo hata/fallback durumunda VLC kontrolü.
