# GPT KIZILKAN Player — GPT v10.6.1

## Referans
Bu paket Claude KIZILKAN Player v10.6.0 kaynak kodunu temel alır.

## İşlevsel kod
Claude v10.6.0'ın player, playlist, focus, navigasyon ve uygulama işlevleri
değiştirilmemiştir.

## Ortak altyapı
- Uygulama adı: GPT KIZILKAN Player
- Expo version: 10.6.1
- iOS buildNumber: 10.6.1
- Android versionCode: 106001
- package.json version: 10.6.1
- package ID: com.kizilkan.player
- Kalıcı ortak release signing GitHub Secrets üzerinden kurulur.
- Yanlış keystore fingerprint'i build'i durdurur.
- APK package/version/signature build sonrası doğrulanır.
- Bir önceki commit'e göre versionCode geri gider veya eşit kalırsa build durur.

PRIVATE signing key bu pakete dahil değildir.
