# KIZILKAN PLAYER v4.5.0 — FAZ B (Xtream emergent bağımlılığı kaldırıldı)

## ⚠️ ÖNEMLİ: Bu build v4.4.0'ı DA içerir
Bir önceki build'i (v4.4.0) kurmadıysan, bu build onun tüm düzeltmelerini de
kapsıyor: liste kalıcılığı, favori bug, KIZILKAN ikon, favoriler sekmesi,
paralel yükleme, Xtream algılama, dinamik sürüm.

## Bu sürümde düzelenler (FAZ B)

### ✅ Dizi/Film detayında "backend'e ulaşılamıyor" hatası KALDIRILDI
- ESKİ: detail ekranı emergent backend'e bağlanıyordu (python-app-builder-13...)
- YENİ: Doğrudan Xtream API'sine bağlanıyor (cihaz-içi)
- Dizi sezon/bölüm listesi artık gelecek, film bilgisi görünecek

### ✅ Catch-up (geriye dönük izleme) cihaz-içi
- Backend proxy yerine doğrudan Xtream get_simple_data_table

### ✅ Liste güncelleme (edit-playlist) cihaz-içi + paralel
- M3U ve Xtream güncelleme artık backend'siz
- Kanallar+filmler+diziler paralel (hızlı)

### ✅ Sürüm bilgisi düzeldi
- "4.0.0 Ultimate" -> artık app.json'dan (4.5.0)
- (Bir önceki build'de düzeltilmişti ama o build kurulmamıştı)

## Emergent'ten kurtulma durumu
- ✅ Xtream: TAMAMEN cihaz-içi (login, kanal, film, dizi, detay, catch-up, güncelleme)
- ✅ M3U: TAMAMEN cihaz-içi
- ⏸️ XMLTV EPG: hâlâ backend (sonraki tur - az kullanılan özellik)
- ⏸️ Stalker/MAC: hâlâ backend (FAZ B2 - ayrı ve dikkatli faz)

## Kalan emergent bağımlılıkları (sonraki fazlar)
- XMLTV harici EPG (fetchEpg, epgNowNext, epgForChannel)
- DVR kayıt planlama (dvrSchedule)
- Stalker/MAC protokolü (FAZ B2)

## KRİTİK: Kurmadan önce eski uygulamayı KALDIR

## Değişen dosyalar (FAZ B)
- app/detail.tsx (cihaz-içi dizi/film bilgisi)
- app/catchup.tsx (cihaz-içi catch-up)
- app/edit-playlist.tsx (cihaz-içi + paralel güncelleme)
- src/utils/iptv.ts (xtreamCatchupEpg eklendi)
- app.json (v4.5.0)
