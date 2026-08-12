# KIZILKAN PLAYER v9.17.0 — Native Android TV Media3 Player

## Amaç
Homatics Box R 4K+ üzerinde kanal listesinden player'a ilk girişte görülen tema
rengi şerit/tint problemi için Android TV playback yolu Expo VideoView zincirinden
ayrıldı. TV'de doğrudan AndroidX Media3 `ExoPlayer + PlayerView` kullanan yerel
Expo Module host edilir. Telefon/tablet Expo Video yolu ve VLC fallback korunur.

## Mimari
- `frontend/modules/kizilkan-media3`: kalıcı local Expo Module.
- Kotlin `KizilkanMedia3View`: native `PlayerView`, native `ExoPlayer`, siyah shutter/background.
- Media3 1.8.0: Expo SDK 54 `expo-video@3.0.16` ile birebir aynı sürüm.
- HLS, DASH ve standart progressive/TS Media3 datasource desteği.
- Kanal bazlı User-Agent ve Referer native HTTP datasource'a aktarılır.
- Native eventler: first frame, state, error, video size.
- Native komutlar: play, pause, seekBy, seekTo; prop'lar: source, paused, volume, rate, fit, buffer.
- TV Media3 hata verirse mevcut VLC fallback korunur.
- v9.16 config-plugin/MainApplication compositor patch'i tamamen kaldırıldı.

## Regresyon koruması
Mevcut kanal çözümleme, Stalker create_link, Xtream/M3U, kayıt/VLC, Cast,
kontrol paneli, zap, tema, telefon/tablet Expo Video yolu kaldırılmadı.

## Sürüm
- Expo: 9.17.0
- iOS buildNumber: 9.17.0
- Android versionCode: 91700
- package.json: 9.17.0
- local module: 9.17.0

## Build kapıları
GitHub Actions prebuild sonrası local module kaynaklarını doğrular ve APK'dan
önce `:kizilkan-media3:compileReleaseKotlin` çalıştırır. Böylece native Kotlin
hatası varsa 17 dakika sonra genel stack trace yerine doğrudan native compile
adımında görünür.

## Doğrulama sınırı
Bu çalışma ortamında npm/yarn registry DNS erişimi olmadığı için `yarn install`,
`expo prebuild` ve Gradle dependency indirme/assemble burada tamamlanamadı.
Çalıştırılabilen KIZILKAN 8 statik denetleyicisi 8/8 temizdir. Gerçek native
compile ve APK build GitHub Actions'taki yeni Kotlin kapısında doğrulanacaktır.
