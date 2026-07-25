# KIZILKAN PLAYER v4.4.0 — Sürüm Notu (FAZ A.4 Bölüm 0)

## Bu sürümde ne düzeldi

### ✅ Liste kaybolması / her açılışta "Liste Ekle" ekranı
- ESKİ: Tüm liste (kanal+film+dizi) tek AsyncStorage anahtarına yazılıyor,
  Android'in ~2MB satır limitini aşınca SESSİZCE kayboluyordu.
- YENİ: Ağır veri dosya sistemine yazılıyor (limit yok). Sadece hafif
  metadata AsyncStorage'da. Yazma başarısı kontrol ediliyor.
- Migration: Eski veri ilk açılışta otomatik yeni yapıya taşınır, KAYBOLMAZ.

### ✅ Favori / "devam et" kaybı (liste yenileyince)
- ESKİ: Kanal ID'leri her yüklemede rastgele üretiliyordu.
- YENİ: ID içerikten türetiliyor (kalıcı). Aynı kanal = aynı ID.
  50.000 kanalda 0 çakışma test edildi.

## Sağlıklı kullanım senaryosu
1. Uygulamayı aç → profil seç → liste ekle → içerik kaydedilir
2. Uygulamayı KAPAT, tekrar AÇ → onboarding GELMEZ, liste durur ✅
3. Favori ekle → kapat-aç → favori durur ✅
4. Listeyi güncelle → favoriler kopmaz ✅

## KRİTİK TEST
Uygulamayı 2-3 kez kapat-aç. Liste duruyorsa bu bölüm başarılı.

## Bu sürümde HENÜZ olmayan (sonraki fazlar)
- Profile özel link (A.5)
- Player codec/http iyileştirmesi (A.4 Bölüm 1)
- Hızlı yükleme (A.4 Bölüm 2)

## Değişen dosyalar
- src/store/PlaylistContext.tsx (v2.0.0)
- src/utils/iptv.ts (deterministik ID)
- src/utils/storage/bigStore.native.ts (YENİ)
- src/utils/storage/bigStore.web.ts (YENİ)
- src/utils/storage/bigStore.ts (YENİ)
- src/utils/storage/bigStore.types.ts (YENİ)
- app/player.tsx (VLC hata mesajı okunur — A.3)
- app.json (v4.4.0)
