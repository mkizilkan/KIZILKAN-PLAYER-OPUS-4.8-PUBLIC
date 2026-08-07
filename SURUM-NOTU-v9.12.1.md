# KIZILKAN PLAYER — SÜRÜM NOTU v9.12.1

**Sürüm:** 9.12.0 → **9.12.1** (versionCode 91200 → 91201)
**Konu:** GitHub Actions TypeScript kalite kapısının yakaladığı derleme hatalarının eksiksiz düzeltilmesi.

## Düzeltmeler

- `ThemePalette.background` kullanan üç ekran `colors.surface` ile uyumlu hale getirildi.
- `Playlist.channelCount` ve VOD/dizi sayaçları lazy metadata modeline tipli olarak eklendi; eski `channelsCount` metadata anahtarıyla geriye uyumluluk korundu.
- `profile-select.tsx` eksik `haptic` importu eklendi.
- Player `SheetType` birliğine mevcut kayıt hedefi paneli (`recordTarget`) eklendi.
- TypeScript'in platform uzantılı `vlc.native.ts` dosyasını bulamaması için `src/native/vlc.ts` çözümleme köprüsü eklendi; Metro runtime seçimi değişmedi.
- Ayarlar ekranındaki tanımsız `next` kullanımı kaldırıldı.
- TV layout seçenekleri `TvLayout` tipine `satisfies` ile açıkça bağlandı.
- v9.12.0 player yüzey/şerit, fuzzy arama, TV focus, catch-up ve Emergent temizlik geliştirmeleri aynen korundu.

## Önemli

Kalite kapısı kaldırılmadı. Amaç hataları gizlemek değil, APK derlemesinden önce yakalayıp düzeltmektir.

## Ek statik temizlik

GitHub'ın annotation ekranı hata listesini sınırlayabildiği için yalnız görünen ilk hatalarla yetinilmedi. Yerel kaynak taramasında ayrıca:

- `VodItem.added` ve `SeriesItem.release_date` yinelenen tip alanları temizlendi.
- M3U VOD/dizi kayıtlarında gerçekten `null` olabilen `stream_id/series_id` tipleri gerçek veri modeline uyarlandı.
- `ChannelActionSheet` tarafından zaten kullanılan `RADIUS.xl` tema sabitine eklendi.

## Doğrulama

- 87 TS/TSX dosyası TypeScript parser/transpile sözdizimi kontrolünden geçti: **0 sözdizimi hatası**.
- KIZILKAN 8 statik denetleyicisi: **8/8 temiz**.
- Aktif frontend/backend alanında eski Emergent prod/preview URL ve paket bağımlılığı taraması temiz.
- Bu çalışma ortamında internet/node_modules bulunmadığı için Expo'nun tam `tsc --noEmit` bağımlılık çözümlemesini yerelde yeniden üretmek mümkün olmadı; GitHub kalite kapısı bunu bağımlılıklar kurulduktan sonra gerçek ortamda yeniden çalıştıracaktır.
