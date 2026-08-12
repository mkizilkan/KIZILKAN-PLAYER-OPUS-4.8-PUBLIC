# KIZILKAN PLAYER — SÜRÜM NOTU v9.15.0

**Sürüm:** 9.14.0 → **9.15.0**  
**buildNumber:** 9.15.0  
**versionCode:** 91500

## Amaç

Homatics Box R 4K+ gerçek cihaz testinde doğrulanan şu davranışı hedefler:

- Player oturumunun **ilk açılan canlı kanalında** tema rengiyle şerit/görüntü boyanması oluşuyor.
- Bir kez ileri/geri zap yapıldıktan sonra aynı player oturumundaki kanallar düzgün kalıyor.
- v9.14.0'daki SurfaceView-first, `useExoShutter`, `onFirstFrameRender` ve native video-stage izolasyonu tek başına yeterli olmadı.

Bu nedenle v9.15.0, ilk player mount ile ilk başarılı zap arasındaki **native source/surface yaşam döngüsü farkını** kullanıcıya görünmeden eşitlemeye odaklanır.

## Yapılan değişiklikler

1. Exo `VideoPlayer` artık ilk anda stream ile değil **`null` source** ile oluşturulur.
2. Opak siyah `nativeVideoStage` önce gerçek layout alır; `onLayout` sonrasında kaynak `replaceAsync()` ile bağlanır.
3. Kanal/URL bazlı `mediaKey` eklendi. Kanal değiştiği render'da siyah kapak effect beklemeden anında devreye girer.
4. `useExoShutter` korunmuştur.
5. Exo `onFirstFrameRender` ilk TV canlı-kanal oturumunda kullanıcıya görüntü açmaz; bunun yerine:
   - kaynak bir kez boşaltılır,
   - `VideoView` generation artırılarak native yüzey remount edilir,
   - yaklaşık 50 ms attach penceresinden sonra **aynı kaynak** tekrar bağlanır,
   - ikinci ilk-kare sinyalinde siyah kapak kaldırılır.
6. Bu warm-up çevrimi yalnız **TV + canlı kanal + player oturumunda bir kez** çalışır. Telefon/tablet, VOD/dizi ve normal zaplar ekstra çevrime girmez.
7. Video üstüne opak siyah `firstFrameCover` eklendi. Exo'da nihai first-frame, VLC'de `onFirstPlay/onPlaying` ile kaldırılır.
8. Callback üretmeyen sıra dışı cihazlarda kalıcı siyah ekran oluşmaması için 8 saniyelik yalnız-görsel failsafe eklendi.
9. VLC'ye geçildiğinde Exo player kaynağı/kod çözücüsü serbest bırakılmaya devam eder; mevcut VLC fallback zinciri korunur.
10. v9.14.0'daki SurfaceView → TextureView → VLC fallback, video/gesture sibling ayrımı, kayıt, zap, altyazı/ses, hız, oran, catch-up ve kumanda davranışları korunmuştur.

## Bilerek bu sürüme alınmayan iş

**TV kanal listesi odak kayması** bu sürümde değiştirilmedi. Video tint/şerit problemiyle farklı hata sınıfıdır; iki değişikliği tek build'de karıştırmamak için ayrı sürümde ele alınacaktır.

## Doğrulama

Gerçek olarak çalıştırılan kontroller:

- KIZILKAN statik denetleyicileri: **8/8 temiz**
- TypeScript 5.x parse/transpile: **87 TS/TSX, 0 sözdizim hatası**
- `app.json` parse: temiz
- `package.json` parse: temiz
- `.github/workflows/build-apk.yml` YAML parse: temiz
- Sürüm üç alan: **9.15.0 / 9.15.0 / 91500**

`typescript@5.7.3` npm kurulumu çalışma ortamında ağ zaman aşımına uğradı. Denetleyiciler ortamda mevcut TypeScript 5.x ile gerçekten çalıştırıldı. Tam `yarn install + tsc --noEmit + Expo prebuild + Gradle` doğrulaması GitHub Actions ortamında yapılacaktır; bu not cihaz/build sonucu için kesin garanti iddiası içermez.

## Homatics test kriteri

1. Uygulamayı tamamen kapatıp yeniden aç.
2. Modern Mavi tema ile daha önce sorun çıkaran ilk canlı kanalı aç.
3. Beklenen geçiş: **siyah → doğrudan doğru renkli video**. Tema renginde şerit/tint görünmemeli.
4. İlk kanaldan sonra 5–10 kez ileri/geri zap yap.
5. Kırmızı tema ile uygulamayı yeniden başlatıp aynı ilk-kanal testini tekrarla.
6. VLC motoru ile de bir canlı kanal açıp siyah kapağın takılı kalmadığını doğrula.
