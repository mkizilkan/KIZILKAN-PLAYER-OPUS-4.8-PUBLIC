# KIZILKAN PLAYER v9.17.1 — Native Media3 Gradle yapılandırma düzeltmesi

## Kök hata
GitHub Actions v9.17.0 gerçek logu:
`A problem occurred configuring project ':kizilkan-media3'.`
`'android.defaultConfig.versionName' is not defined`

Hata Kotlin koduna ulaşmadan, Expo Module Gradle plugin'in publication metadata
hazırlığı sırasında oluşuyordu.

## Düzeltme
`frontend/modules/kizilkan-media3/android/build.gradle` içinde Android library
`defaultConfig.versionName` açıkça tanımlandı.

```gradle
group = 'com.kizilkan.media3'
version = '9.17.1'

android {
  namespace "com.kizilkan.media3"
  defaultConfig {
    versionName "9.17.1"
  }
}
```

Native Media3 Kotlin player kaynaklarına bu sürümde başka değişiklik yapılmadı.
Amaç doğrulanmış Gradle configuration engelini kaldırıp CI'ın gerçek
`:kizilkan-media3:compileReleaseKotlin` aşamasına ulaşmasını sağlamaktır.

## Sürüm
- Expo version: 9.17.1
- iOS buildNumber: 9.17.1
- Android versionCode: 91701
- package.json: 9.17.1
- local Media3 module package/version: 9.17.1

## Kontroller
- KIZILKAN statik denetleyicileri: 8/8 temiz.
- TypeScript 5.8.3: 90 TS/TSX, parse/transpile hata: 0.
- JSON/YAML parse: temiz.
- Gradle invariant: `versionName "9.17.1"` mevcut.
- v9.17.0 ile native Kotlin kaynak hash karşılaştırması: değişmedi.
- ZIP CRC: temiz.

## Dürüst sınır
Bu çalışma ortamında Android Gradle bağımlılıkları/prebuild projesi hazır olmadığı
için gerçek `:kizilkan-media3:compileReleaseKotlin` burada çalıştırılmadı.
GitHub Actions yeni pakette bu kapıyı gerçek Android ortamında çalıştıracaktır.
