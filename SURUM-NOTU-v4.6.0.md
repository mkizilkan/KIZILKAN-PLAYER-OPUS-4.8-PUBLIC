# KIZILKAN PLAYER v4.6.0 — Paket 1

## Bu sürümde eklenenler/düzelenler

### ✅ XMLTV EPG cihaz-içi (emergent bağımlılığı kaldırıldı)
- M3U listelerinin harici EPG'si artık backend'siz: indir, ayrıştır, sakla, oku
- Türkçe karakterler + XML entity'leri (&amp; &#39;) + zaman dilimi doğru (test edildi)
- 6 saat cache, süresi dolunca otomatik yenilenir

### ✅ İndirme düzeltmesi (P0-8)
- expo-file-system@19 için /legacy import -> indirme fonksiyonları çalışır

### ✅ Player spinner bug düzeltildi
- ESKİ: duraklatınca sonsuz dönen yükleme animasyonu
- YENİ: spinner sadece GERÇEKTEN yüklenirken döner (isBuffering)

### ✅ Çift dokunuş ileri/geri düzeltildi (P0-5)
- ESKİ: her çift dokunuş -10s yapıyordu (iki jest çakışıyordu)
- YENİ: ekranın SOL yarısı -10s, SAĞ yarısı +10s

### ✅ IPTV Extreme tarzı uzun-bas menüsü (YENİ)
- Kanala/filme/diziye uzun basınca zengin menü:
  Oynat, Bilgi, EPG, Catch-up, Favori, İzleme listesi, Gizle
- Canlı/film/dizi'ye göre farklı öğeler
- TV Box için kumanda ile gezilebilir (focusable)
- ESKİ: basit Alert (3-4 buton)

## Emergent'ten kurtulma durumu
- ✅ Xtream: TAMAMEN cihaz-içi
- ✅ M3U: TAMAMEN cihaz-içi
- ✅ XMLTV EPG: TAMAMEN cihaz-içi (YENİ)
- ⏸️ DVR: sonra (player motoru + VLC record ile)
- ⏸️ Stalker/MAC: FAZ B2

## Test edilecekler
1. Uzun-bas menüsü (kanala uzun bas) - zengin menü açılıyor mu
2. Çift dokunuş: sol=geri, sağ=ileri
3. Player duraklatınca spinner DÖNMÜYOR
4. XMLTV EPG'li M3U listesinde program rehberi geliyor mu
5. İndirme çalışıyor mu (bir filmde "İndir")

## Değişen dosyalar
- src/utils/epg.ts (YENİ - cihaz-içi XMLTV)
- src/components/ChannelActionSheet.tsx (YENİ - uzun-bas menüsü)
- app/(tabs)/index.tsx (zengin menü entegrasyonu)
- app/(tabs)/settings.tsx, app/epg.tsx, app/epg-timeline.tsx (cihaz-içi EPG)
- app/player.tsx (spinner + çift dokunuş)
- src/store/DownloadContext.tsx (/legacy)
- app.json (v4.6.0)
