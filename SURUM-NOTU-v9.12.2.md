# KIZILKAN PLAYER — SÜRÜM NOTU v9.12.2

**Sürüm:** 9.12.1 → **9.12.2** (versionCode 91201 → 91202)

## GitHub TypeScript build kapısı düzeltmeleri

- `quickActions.ts`: `initial.params` async callback içinde yeniden okunmuyor; href güvenli değişkene alınarak null/undefined daraltması korunuyor.
- `src/native/cast.ts`: Metro platform dosyalarına dokunmadan TypeScript çözümleme köprüsü eklendi.
- `SmartVideoPlayer.tsx`: eski VLC component API'si (`source/autoplay/resizeMode/onProgress/onLoad`) güncel `VlcPlayerView` API'sine (`uri/paused/contentFit/onTimeChanged/onFirstPlay`) taşındı.
- `SmartVideoPlayer.tsx`: import edilmiş component fonksiyonuna yapılan ve TypeScript'in "her zaman true" olarak yakaladığı üç truthiness kontrolü kaldırıldı.
- `TvContext.tsx`: eski sürümlerdeki `"tivimate"` TV düzeni değeri geriye uyumlu alias olarak kabul edilip kalıcı olarak `"columns"` değerine migrate ediliyor.
- TypeScript kalite kapısı KALDIRILMADI; hataları gizlemek yerine kaynak kod düzeltildi.
- v9.12.0/v9.12.1 player yüzey izolasyonu, TV focus, fuzzy arama, catch-up ve Emergent temizliği korunmuştur.
