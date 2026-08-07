# KIZILKAN PLAYER v9.12.2 — Build Gate Düzeltme Raporu

## GitHub Actions v9.12.1 hata eşleştirmesi

1. `initial.params` null/undefined olabilir → `quickActions.ts` içinde href async callback öncesi güvenli sabite alındı.
2. Eski VLC wrapper prop nesnesi güncel `VlcPlayerView` tipine uymuyor → `SmartVideoPlayer.tsx` güncel `uri/paused/contentFit/onTimeChanged/onFirstPlay` API'sine taşındı.
3. Üç adet “koşul her zaman true” → import edilmiş `VLCPlayer` component fonksiyonu üzerinde truthiness kontrolleri kaldırıldı.
4. `@/src/native/cast` TypeScript tarafından çözülemiyor → `src/native/cast.ts` type-resolution bridge eklendi; Metro native/web seçimi korunuyor.
5. Eski `"tivimate"` TV layout çağrısı `TvLayout` ile uyumsuz → legacy alias kabul edilip runtime/persist katmanında `columns` değerine migrate ediliyor.

## Doğrulamalar

- KIZILKAN statik denetleyicileri: 8/8 temiz.
- 88 TS/TSX dosyası TypeScript parser ile sözdizimi kontrolünden geçti: 0 hata.
- v9.12.0 player yüzey izolasyonu/şerit çözümü, fuzzy arama, TV focus, catch-up ve Emergent temizliği korunmuştur.
- TypeScript kalite kapısı kaldırılmadı.

## Sürüm

- app: 9.12.2
- Android versionCode: 91202
- iOS buildNumber: 9.12.2
- package: 9.12.2
