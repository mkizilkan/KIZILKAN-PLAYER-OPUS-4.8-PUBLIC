# KIZILKAN PLAYER v9.16.0 — Şerit/Tint Android Compositor Düzeltmesi

## Gerçek cihaz bulgusuna dayanan değişiklik
Homatics Box R 4K+ testlerinde sorun yalnız kanal listesinden player ekranına yeni
girişte oluşuyor; gerçek zap veya player alt panelini (React Native Modal) açıp
kapatmak görüntüyü anında normale döndürüyor. v9.15.0'daki Exo shutter, siyah
first-frame kapağı, source rebind ve VideoView remount sorunu çözmedi.

Bu nedenle v9.16.0 medya kaynağını yeniden başlatmak yerine Android pencere/view
composition traversal'ını hedefler.

## Değişiklikler
- `KizilkanCompositor` adlı küçük Android NativeModule config-plugin ile prebuild
  sırasında üretilir ve `MainApplication` paket listesine kaydedilir.
- İlk TV/Android Exo karesinde, siyah kapak kalkmadan önce `decorView/rootView`
  üzerinde `requestLayout`, `invalidate`, `postInvalidateOnAnimation` çalışır.
- Aynı traversal içinde görünmez 1x1 native View bir frame attach/detach edilir.
  Bu işlem yeni bir Modal/window açmaz, kanal/source/decoder değiştirmez.
- İşlem player ekranı oturumunda yalnız bir kez çalışır; normal zap akışına
  müdahale etmez.
- Native köprü bulunamaz veya hata verirse uygulama çökmez; siyah kapak yaklaşık
  iki frame sonra kaldırılır.
- v9.15.0'daki SurfaceView-first, TextureView fallback, Exo shutter, first-frame
  cover, VLC fallback ve diğer player özellikleri korunmuştur.
- İncelemede `SheetType` içinde kullanımda olduğu halde eksik kalan
  `recordTarget` tipi de geri eklenmiştir.
- GitHub Actions, Expo prebuild sonrası native modül dosyalarını ve
  `MainApplication` kaydını doğrular; eksikse Gradle'dan önce açık hata verir.

## Sürüm
- Expo version: 9.16.0
- iOS buildNumber: 9.16.0
- Android versionCode: 91600
- package.json: 9.16.0

## Doğrulama
- KIZILKAN statik denetleyicileri: 8/8 temiz.
- TypeScript 5.8.3 ile 87 TS/TSX dosyasında parse/transpile hatası: 0.
- Yeni config-plugin `node --check`: temiz.
- JSON ve workflow YAML parse: temiz.
- ZIP CRC bütünlük kontrolü: temiz.

## Dürüst sınır
Bu ortamda frontend `node_modules` bulunmadığı için gerçek Expo prebuild/Gradle
APK derlemesi yerelde çalıştırılamadı. GitHub Actions bunu gerçek bağımlılıklarla
yapacak. Homatics cihazında şerit/tint'in kesin giderildiği iddia edilmez; bu
sürüm, gerçek zap ve Modal davranışından çıkarılan Android compositor hipotezini
doğrudan test eder.
