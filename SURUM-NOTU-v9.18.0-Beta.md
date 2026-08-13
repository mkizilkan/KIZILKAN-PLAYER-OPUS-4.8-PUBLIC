# KIZILKAN PLAYER v9.18.0 Beta — Native Android TV Playback Activity / FAZ-1

## Amaç
v9.17.1'de Media3 motoru native yapılmıştı ancak `PlayerView`, `ExpoView` olarak
React Native Activity/View ağacının içinde kalıyordu. v9.18.0 Beta FAZ-1'in
amacı video yüzeyini tamamen ayrı bir Android `Activity` ve `Window` içine
taşıyarak ilk kanal açılışındaki tema renklenmesi/şerit sorununu Window
seviyesinde izole etmektir.

## Yeni native mimari
- `KizilkanPlaybackActivity : Activity`
- Tam siyah bağımsız Android Window
- Native `PlayerView`
- Media3 `ExoPlayer`
- Native siyah shutter
- Landscape + immersive TV görünümü
- KEEP_SCREEN_ON
- D-pad UP / CHANNEL_UP / MEDIA_NEXT: sonraki kanal
- D-pad DOWN / CHANNEL_DOWN / MEDIA_PREVIOUS: önceki kanal
- OK/ENTER/MEDIA_PLAY_PAUSE: play/pause
- BACK: standart Activity dönüşü
- Aynı ExoPlayer instance üzerinde zap

## Regresyon koruması
- Telefon/tablet yolu değiştirilmedi.
- Kullanıcı VLC seçmişse mevcut VLC yolu korunur.
- Stalker playback mevcut çözümleme yolu korunması için bu Beta FAZ-1'de
  Activity izolasyonuna zorlanmaz.
- Eski `KizilkanMedia3View` kaldırılmadı.
- Kayıt, cast ve mevcut RN player özellikleri silinmedi.

## Sürüm
- Görünen etiket: v9.18.0 Beta
- Expo version: 9.18.0
- iOS buildNumber: 9.18.0
- Android versionCode: 91800
- package.json: 9.18.0
- local Media3 module: 9.18.0

`Beta` kelimesi teknik semver/versionCode alanlarını bozmayacak şekilde
`expo.extra.kizilkanReleaseLabel` ve CI APK/Release adına eklenmiştir.

## CI kapıları
- KIZILKAN 8 statik denetleyici
- Expo prebuild
- Native Media3 Kotlin compile
- `processReleaseMainManifest`
- merged manifest içinde `KizilkanPlaybackActivity` doğrulaması
- assembleRelease

## Bu ortamda doğrulananlar
- 8/8 KIZILKAN denetleyicisi temiz.
- app/package/module JSON parse temiz.
- workflow YAML parse temiz.
- sürüm invariantları temiz.
- Activity / bridge / manifest / player.tsx bağlantı invariantları temiz.
- ZIP CRC temiz.

## Dürüst sınır
Bu çalışma ortamında npm registry erişimi zaman aşımına uğradığı için
TypeScript 5.7.3 kurulamadı; dolayısıyla tam `tsc --noEmit` burada
çalıştırılmadı. Android SDK/Gradle bağımlılık ortamı da bu paketin yanında
hazır olmadığı için gerçek Kotlin compile/assemble burada çalıştırılmadı.
Bunları GitHub Actions'taki kapılar gerçek Android ortamında çalıştıracaktır.

## TV test sırası
1. Player seçimi Media3/Expo yolundayken kanal listesinden ilk kanalı aç.
2. İlk kare öncesi ve ilk karede şerit/tint var mı kontrol et.
3. Temayı mavi ve kırmızı yapıp tekrar ilk kanalı aç.
4. D-pad UP/DOWN ile birkaç zap yap.
5. BACK ile listeye dön, başka kanalı listeden yeniden aç.
6. Sonuç temizse FAZ-2'de mevcut TV kontrol paneli/track/record vb. özellikler
   native Activity'ye eksiksiz taşınacaktır.
