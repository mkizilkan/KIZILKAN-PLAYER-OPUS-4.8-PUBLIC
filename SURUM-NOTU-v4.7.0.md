# KIZILKAN PLAYER v4.7.0 — Zengin Menü + Profesyonel İndirme

## Zengin uzun-bas menüsü (genişletildi)
Artık kanala/filme/diziye uzun basınca:
- Oynat
- Bilgi / Detay (vod/dizi)
- Program Rehberi EPG (canlı)
- Geriye Dönük İzle / Catch-up (arşiv varsa)
- Çoklu Ekran / Multi-view (canlı)
- Favori ekle/çıkar
- İzleme listesi (vod/dizi)
- İndir (film)
- Bağlantıyı Paylaş
- Gizle

## Profesyonel indirme (senin istediklerin)

### ✅ Dosya adı + boyut gösterimi
- İndir'e basınca diyalog açılır: dosya adı ve tahmini boyut (HEAD isteğiyle)

### ✅ Hedef klasör seçimi
- "Uygulama içi" veya "İndirilenler klasörü (paylaşılabilir)"
- "Varsayılan yap" seçeneği - bir daha sormaz
- (Galeri hedefi: player motoru fazında native ile gelecek)

### ✅ GERÇEK duraklat/devam (5GB sorunu çözüldü)
- ESKİ: duraklatınca resume SIFIRDAN başlıyordu (kod bunu itiraf ediyordu)
- YENİ: pause anında resumeData saklanıyor, resume kaldığı yerden devam ediyor
- 5GB film kopunca/duraklayınca baştan İNMEZ

## Test edilecekler
1. Filme uzun bas -> zengin menü (İndir, Paylaş, Bilgi...)
2. İndir -> diyalog (ad+boyut+hedef seçimi) açılmalı
3. Büyük dosya indir -> duraklat -> devam et -> KALDIĞI YERDEN devam etmeli
4. "İndirilenler" seç -> tamamlanınca paylaş menüsü açılmalı

## Değişen dosyalar
- src/store/DownloadContext.tsx (gerçek resume + hedef)
- src/components/DownloadDialog.tsx (YENİ - indirme diyaloğu)
- app/detail.tsx (diyalog entegrasyonu)
- app/(tabs)/index.tsx (zengin menü)
- app.json (v4.7.0)

## NATİVE-RİSKSİZ
Yeni native paket eklenmedi. Bu build derlenmeli.
